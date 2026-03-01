/**
 * Guest Booking Validation
 *
 * ゲスト予約入力のバリデーション。
 */

import validator from "validator"
import { getBookingMinHoursAhead } from "@/lib/settings/app-settings"

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
export async function validateGuestBooking(input: GuestBookingInput): Promise<ValidationResult> {
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

  // 予約可能時間の検証（DB設定の時間後以降のみ予約可能）
  if (input.startTime) {
    const start = new Date(input.startTime)
    if (!isNaN(start.getTime())) {
      const bookingMinHoursAhead = await getBookingMinHoursAhead()
      const minBookingTime = new Date()
      minBookingTime.setHours(minBookingTime.getHours() + bookingMinHoursAhead)
      if (start <= minBookingTime) {
        errors.push(`予約は${bookingMinHoursAhead}時間後以降の日時を選択してください`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}
