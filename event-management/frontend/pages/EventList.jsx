import { useEffect, useState } from 'react'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'

const MOCK_EVENTS = [
  {
    event_id: '1',
    name: 'AUSTRC Demo Event',
    venue: 'AUST Campus',
    start_at: '2026-10-01',
    status: 'DRAFT',
  },
  {
    event_id: '2',
    name: 'Robotics Workshop',
    venue: 'Lab 4',
    start_at: '2026-10-15',
    status: 'PUBLISHED',
  },
  {
    event_id: '3',
    name: 'Line Following Championship',
    venue: 'Main Auditorium',
    start_at: '2026-11-02',
    status: 'PUBLISHED',
  },
]

const STATUS_VARIANT = {
  DRAFT: 'neutral',
  PUBLISHED: 'success',
  CLOSED: 'warning',
  ARCHIVED: 'neutral',
}

function EventList() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [events, setEvents] = useState([])

  useEffect(() => {
    // Simulated fetch — replace with real API call later.
    const timer = setTimeout(() => {
      try {
        setEvents(MOCK_EVENTS)
      } catch {
        setError('Failed to load events.')
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="animate-rise">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="font-mono text-xs uppercase tracking-[0.16em] text-brand-400">
            Event Management
          </span>
          <h1 className="mt-2 text-3xl">Events</h1>
          <p className="mt-1 text-muted">
            Every event created in the Event Module.
          </p>
        </div>
        <Button variant="primary" size="md">
          Create event
        </Button>
      </header>

      {loading && (
        <div className="grid place-items-center py-20">
          <Loader label="Loading events" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-6 text-danger">
          {error}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="rounded-md border border-edge bg-surface-1 p-10 text-center">
          <p className="text-muted">No events yet.</p>
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" size="md">
              Create the first event
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <li
              key={event.event_id}
              className="rounded-md border border-edge bg-surface-1 p-5 transition-colors duration-base ease-standard hover:border-edge-strong hover:bg-surface-2"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg text-ink">{event.name}</h2>
                <Badge variant={STATUS_VARIANT[event.status] ?? 'neutral'}>
                  {event.status}
                </Badge>
              </div>
              <dl className="mt-4 space-y-1 text-sm text-subtle">
                <div>
                  <dt className="inline text-faint">Venue: </dt>
                  <dd className="inline text-muted">{event.venue}</dd>
                </div>
                <div>
                  <dt className="inline text-faint">Starts: </dt>
                  <dd className="inline text-muted">{event.start_at}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default EventList