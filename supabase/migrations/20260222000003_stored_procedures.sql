-- =============================================================================
-- Stored Procedures for Time with Kazumin
-- =============================================================================
-- Phase 1: ポイント管理用Stored Procedures
-- SELECT FOR UPDATE NOWAITによるレースコンディション防止
-- =============================================================================

-- =============================================================================
-- consume_points() - ポイント消費
-- =============================================================================
-- 予約時にポイントを消費。NOWAITでロック取得失敗時は即座にエラー。
-- クライアント側でリトライロジックを実装する。
-- =============================================================================
CREATE OR REPLACE FUNCTION consume_points(
    p_member_plan_id INTEGER,
    p_points INTEGER,
    p_transaction_type TEXT DEFAULT 'consume',
    p_reference_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- ロック取得（NOWAIT: 競合時は即座にエラー）
    SELECT current_points INTO v_current_balance
    FROM member_plans
    WHERE id = p_member_plan_id
    FOR UPDATE NOWAIT;

    -- プラン存在チェック
    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Member plan not found: %', p_member_plan_id;
    END IF;

    -- 残高チェック（マイナス残高は拒否）
    IF v_current_balance < p_points THEN
        RAISE EXCEPTION 'Insufficient points: available=%, required=%', v_current_balance, p_points;
    END IF;

    -- ポイント消費
    v_new_balance := v_current_balance - p_points;
    UPDATE member_plans
    SET current_points = v_new_balance,
        updated_at = NOW()
    WHERE id = p_member_plan_id;

    -- 履歴記録
    INSERT INTO point_transactions (
        member_plan_id,
        points,
        transaction_type,
        reference_id,
        notes,
        balance_after
    ) VALUES (
        p_member_plan_id,
        -p_points,
        p_transaction_type,
        p_reference_id,
        p_notes,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

-- セキュリティ: authenticatedロールのみ実行可能
REVOKE EXECUTE ON FUNCTION consume_points FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_points TO authenticated;

-- =============================================================================
-- refund_points() - ポイント返還
-- =============================================================================
-- キャンセル時などにポイントを返還。
-- =============================================================================
CREATE OR REPLACE FUNCTION refund_points(
    p_member_plan_id INTEGER,
    p_points INTEGER,
    p_transaction_type TEXT DEFAULT 'refund',
    p_reference_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- ロック取得（返還は競合少ないが、整合性のためロック）
    SELECT current_points INTO v_current_balance
    FROM member_plans
    WHERE id = p_member_plan_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Member plan not found: %', p_member_plan_id;
    END IF;

    -- ポイント返還
    v_new_balance := v_current_balance + p_points;
    UPDATE member_plans
    SET current_points = v_new_balance,
        updated_at = NOW()
    WHERE id = p_member_plan_id;

    -- 履歴記録
    INSERT INTO point_transactions (
        member_plan_id,
        points,
        transaction_type,
        reference_id,
        notes,
        balance_after
    ) VALUES (
        p_member_plan_id,
        p_points,
        p_transaction_type,
        p_reference_id,
        p_notes,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

REVOKE EXECUTE ON FUNCTION refund_points FROM PUBLIC;
GRANT EXECUTE ON FUNCTION refund_points TO authenticated;

-- =============================================================================
-- grant_monthly_points() - 月次ポイント付与
-- =============================================================================
-- 毎月1日に全アクティブ会員にポイントを付与。
-- max_pointsを超えないように上限あり繰り越しを実装。
-- =============================================================================
CREATE OR REPLACE FUNCTION grant_monthly_points()
RETURNS TABLE(member_plan_id INTEGER, granted_points INTEGER, new_balance INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member_plan RECORD;
    v_plan_max_points INTEGER;
    v_new_balance INTEGER;
    v_granted INTEGER;
BEGIN
    -- アクティブな全会員プランを処理
    FOR v_member_plan IN
        SELECT mp.id, mp.current_points, mp.monthly_points, mp.plan_id
        FROM member_plans mp
        WHERE mp.status = 'active'
        FOR UPDATE
    LOOP
        -- プランの上限取得（NULLは無制限）
        SELECT p.max_points INTO v_plan_max_points
        FROM plans p
        WHERE p.id = v_member_plan.plan_id;

        -- 繰り越し上限計算
        IF v_plan_max_points IS NULL THEN
            -- 無制限の場合、全額付与
            v_new_balance := v_member_plan.current_points + v_member_plan.monthly_points;
            v_granted := v_member_plan.monthly_points;
        ELSE
            -- 上限ありの場合、max_pointsを超えない範囲で付与
            v_new_balance := LEAST(
                v_member_plan.current_points + v_member_plan.monthly_points,
                v_plan_max_points
            );
            v_granted := v_new_balance - v_member_plan.current_points;
        END IF;

        -- ポイント更新
        UPDATE member_plans
        SET current_points = v_new_balance,
            updated_at = NOW()
        WHERE id = v_member_plan.id;

        -- 履歴記録
        INSERT INTO point_transactions (
            member_plan_id,
            points,
            transaction_type,
            reference_id,
            notes,
            balance_after
        ) VALUES (
            v_member_plan.id,
            v_granted,
            'monthly_grant',
            NULL,
            'Monthly point grant',
            v_new_balance
        );

        -- 結果返却
        member_plan_id := v_member_plan.id;
        granted_points := v_granted;
        new_balance := v_new_balance;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- セキュリティ: service_roleのみ実行可能（Edge Functions用）
REVOKE EXECUTE ON FUNCTION grant_monthly_points FROM PUBLIC;
GRANT EXECUTE ON FUNCTION grant_monthly_points TO service_role;

-- =============================================================================
-- manual_adjust_points() - 手動ポイント調整
-- =============================================================================
-- 管理者による手動調整（付与/減算）。理由入力は任意。
-- =============================================================================
CREATE OR REPLACE FUNCTION manual_adjust_points(
    p_member_plan_id INTEGER,
    p_points INTEGER,  -- 正の値で付与、負の値で減算
    p_notes TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_balance INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- ロック取得
    SELECT current_points INTO v_current_balance
    FROM member_plans
    WHERE id = p_member_plan_id
    FOR UPDATE;

    IF v_current_balance IS NULL THEN
        RAISE EXCEPTION 'Member plan not found: %', p_member_plan_id;
    END IF;

    v_new_balance := v_current_balance + p_points;

    -- マイナス残高チェック
    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Cannot reduce points below zero: current=%, adjustment=%', v_current_balance, p_points;
    END IF;

    -- ポイント更新
    UPDATE member_plans
    SET current_points = v_new_balance,
        updated_at = NOW()
    WHERE id = p_member_plan_id;

    -- 履歴記録
    INSERT INTO point_transactions (
        member_plan_id,
        points,
        transaction_type,
        reference_id,
        notes,
        balance_after
    ) VALUES (
        p_member_plan_id,
        p_points,
        'manual_adjust',
        NULL,
        p_notes,
        v_new_balance
    );

    RETURN v_new_balance;
END;
$$;

-- セキュリティ: service_roleのみ実行可能（管理者API用）
REVOKE EXECUTE ON FUNCTION manual_adjust_points FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manual_adjust_points TO service_role;
