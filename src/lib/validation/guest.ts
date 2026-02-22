/**
 * Guest Booking Validation
 *
 * ゲスト予約入力のバリデーション。
 */

import validator from "validator"

interface GuestBookingInput {
  email: string
  name: string
  slotDate: string
  startTime: string
  endTime: string
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * ゲスト予約入力をバリデート
 *
 * @param input - ゲスト予約入力
 * @returns バリデーション結果
 */
export function validateGuestBooking(input: GuestBookingInput): ValidationResult {
  const errors: string[] = []

  // メールアドレスの検証
  if (!input.email || !input.email.trim()) {
    errors.push("メールアドレスは必須です")
  } else if (!validator.isEmail(input.email)) {
    errors.push("有効なメールアドレスを入力してください")
  }

  // 名前の検証
  if (!input.name || !input.name.trim()) {
    errors.push("お名前は必須です")
  } else {
    const trimmedName = input.name.trim()
    if (trimmedName.length < 2) {
      errors.push("お名前は2文字以上で入力してください")
    } else if (trimmedName.length > 100) {
      errors.push("お名前は100文字以内で入力してください")
    }
  }

  // 日付の検証
  if (!input.slotDate || !input.slotDate.trim()) {
    errors.push("予約日は必須です")
  } else if (!validator.isDate(input.slotDate, { format: "YYYY-MM-DD", strictMode: true })) {
    errors.push("予約日の形式が正しくありません")
  }

  // 開始時刻の検証
  if (!input.startTime || !input.startTime.trim()) {
    errors.push("開始時刻は必須です")
  } else if (!validator.isISO8601(input.startTime)) {
    errors.push("開始時刻の形式が正しくありません")
  }

  // 終了時刻の検証
  if (!input.endTime || !input.endTime.trim()) {
    errors.push("終了時刻は必須です")
  } else if (!validator.isISO8601(input.endTime)) {
    errors.push("終了時刻の形式が正しくありません")
  }

  // 開始時刻 < 終了時刻の検証
  if (input.startTime && input.endTime) {
    const start = new Date(input.startTime)
    const end = new Date(input.endTime)
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (start >= end) {
        errors.push("終了時刻は開始時刻より後に設定してください")
      }
    }
  }

  // 未来日時の検証
  if (input.startTime) {
    const start = new Date(input.startTime)
    if (!isNaN(start.getTime()) && start <= new Date()) {
      errors.push("予約は未来の日時を選択してください")
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
