// Mirrors the API responses of the Lambda functions (src/shared/*.ts in the backend).

export interface TimeInfo {
  timezone: string
  datetime: string
  date: string
  time: string
  dayOfWeek: string
  utcOffset: string
  utcDatetime: string
  unixTime: number
}

export interface Participant {
  name: string
  timezone: string
}

export interface Meeting {
  id: string
  title: string
  start: string
  timezone: string
  startUtc: string
  durationMinutes: number
  remindBeforeMinutes: number
  remindAtUtc: string
  participants: Participant[]
  createdAt: string
}

export interface ParticipantTime {
  name: string
  timezone: string
  start: string
  end: string
  utcOffset: string
}

export interface MeetingDetail extends Meeting {
  times: ParticipantTime[]
}

export interface CreatedMeeting extends MeetingDetail {
  subscription: "subscribed" | "pending-confirmation"
}

export interface MeetingInput {
  title: string
  start: string
  timezone: string
  durationMinutes: number
  remindBeforeMinutes: number
  participants: Participant[]
}
