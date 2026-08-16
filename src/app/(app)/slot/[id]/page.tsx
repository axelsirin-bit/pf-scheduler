import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getSlotDetail, getActiveRooms } from '@/lib/db/rounds'
import { JoinRoundForm, LeaveRoundButton, CancelRoundForm, SetRoomForm } from '@/lib/components/round-actions'

const RESULT_ELIGIBLE_STATUSES = ['confirmed', 'awaiting_result', 'completed']

function formatDateTime(startsAt: string, endsAt: string, timeZone: string): string {
  const day = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date(startsAt))
  const time = new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' })
  return `${day}, ${time.format(new Date(startsAt))}–${time.format(new Date(endsAt))}`
}

function roundStatusLabel(status: string): string {
  switch (status) {
    case 'forming':
      return 'Forming'
    case 'confirmed':
      return 'Confirmed'
    case 'awaiting_result':
      return 'Awaiting result'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    case 'expired':
      return 'Expired'
    default:
      return status
  }
}

export default async function SlotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getCurrentUser()

  if (!user.school) {
    throw new Error(`No school found for profile ${user.id}`)
  }

  const slot = await getSlotDetail(id, user.school_id, user.id, user.roles)
  if (!slot) {
    notFound()
  }

  const isAdmin = user.roles.includes('admin')
  const round = slot.round
  const isParticipant = round?.participants.some((p) => p.userId === user.id) ?? false

  let rooms: { id: string; name: string }[] = []
  if (round && round.needsRoom && (isParticipant || isAdmin)) {
    rooms = await getActiveRooms(user.school_id)
  }

  const team1 = round?.participants.filter((p) => p.role === 'debater' && p.team === 1) ?? []
  const team2 = round?.participants.filter((p) => p.role === 'debater' && p.team === 2) ?? []
  const judge = round?.participants.find((p) => p.role === 'judge') ?? null

  const actionsAllowed = !slot.isPast && slot.isOpen
  const canCancel = round ? isAdmin || round.createdBy === user.id : false

  return (
    <>
      <h1 className="text-xl font-semibold">{slot.label}</h1>
      <p className="mt-1 text-sm text-neutral-600">
        {formatDateTime(slot.startsAt, slot.endsAt, user.school.timezone)}
      </p>
      {slot.isPast && <p className="mt-1 text-sm text-neutral-500">This slot has already happened.</p>}
      {!slot.isOpen && <p className="mt-1 text-sm text-neutral-500">This slot isn&apos;t open for signup.</p>}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Available</h2>
      {slot.available.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-600">No one has marked themselves available yet.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
          {slot.available.map((a) => (
            <li key={a.userId}>{a.displayName}</li>
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-sm font-semibold text-neutral-900">Round</h2>
      {!round ? (
        <p className="mt-2 text-sm text-neutral-600">No one has started a round for this slot yet.</p>
      ) : (
        <div className="mt-2 rounded border border-neutral-200 p-3 text-sm">
          <p className="font-medium text-neutral-900">{roundStatusLabel(round.status)}</p>
          {round.room && <p className="mt-1 text-neutral-700">Room: {round.room}</p>}
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold text-neutral-500">Team 1</p>
              {team1.length === 0 ? (
                <p className="text-neutral-500">Open</p>
              ) : (
                team1.map((p) => <p key={p.userId}>{p.displayName}</p>)
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500">Team 2</p>
              {team2.length === 0 ? (
                <p className="text-neutral-500">Open</p>
              ) : (
                team2.map((p) => <p key={p.userId}>{p.displayName}</p>)
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-neutral-500">Judge</p>
              <p className={judge ? '' : 'text-neutral-500'}>{judge ? judge.displayName : 'Open'}</p>
            </div>
          </div>
          {RESULT_ELIGIBLE_STATUSES.includes(round.status) && (
            <Link href={`/round/${round.id}/result`} className="mt-2 inline-block text-sm underline">
              {round.status === 'completed' ? 'View result' : 'Submit result'}
            </Link>
          )}
        </div>
      )}

      {actionsAllowed && (
        <div className="mt-4">
          {!isParticipant && (
            <JoinRoundForm
              slotId={id}
              mode={round ? 'join' : 'start'}
              canJudge={user.roles.includes('judge')}
              judgeTaken={judge !== null}
              team1Full={team1.length >= 2}
              team2Full={team2.length >= 2}
            />
          )}
          {round && isParticipant && round.status === 'forming' && <LeaveRoundButton roundId={round.id} />}
          {round && isParticipant && round.status === 'confirmed' && (
            <>
              {canCancel && <CancelRoundForm roundId={round.id} />}
              {round.needsRoom && <SetRoomForm roundId={round.id} rooms={rooms} />}
            </>
          )}
        </div>
      )}
    </>
  )
}
