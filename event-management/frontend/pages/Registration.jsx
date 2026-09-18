
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Button from '../../../shared-features/frontend/components/Button.jsx'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'

const MOCK_FIELDS = [
  { field_id: '1', label: 'Full Name', field_type: 'TEXT', required: true },
  { field_id: '2', label: 'Email Address', field_type: 'EMAIL', required: true },
  { field_id: '3', label: 'Phone Number', field_type: 'TEXT', required: false },
  {
    field_id: '4',
    label: 'Team',
    field_type: 'SELECT',
    required: false,
    options: ['Robotics', 'Programming', 'Electronics'],
  },
]

function Registration() {
  const { eventId } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fields, setFields] = useState([])

  useEffect(() => {
    // Simulated fetch â€” replace with real API call later.
    const timer = setTimeout(() => {
      try {
        setFields(MOCK_FIELDS)
      } catch {
        setError('Failed to load registration form.')
      } finally {
        setLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [eventId])

  return (
    <section className="animate-rise">
      <header className="mb-8">
        <span className="font-mono text-xs uppercase tracking-[0.16em] text-brand-400">
          Event #{eventId}
        </span>
        <h1 className="mt-2 text-3xl">Registration</h1>
        <p className="mt-1 text-muted">
          Fill in the form below to register for this event.
        </p>
      </header>

      {loading && (
        <div className="grid place-items-center py-20">
          <Loader label="Loading form" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-danger/30 bg-danger/10 p-6 text-danger">
          {error}
        </div>
      )}

      {!loading && !error && fields.length === 0 && (
        <div className="rounded-md border border-edge bg-surface-1 p-10 text-center">
          <p className="text-muted">Registration is not open yet.</p>
          <p className="mt-1 text-sm text-subtle">
            Check back when the organizer opens registration.
          </p>
        </div>
      )}

      {!loading && !error && fields.length > 0 && (
        <form
          className="max-w-2xl space-y-6 rounded-md border border-edge bg-surface-1 p-6"
          onSubmit={(e) => e.preventDefault()}
        >
          {fields.map((field) => (
            <div key={field.field_id} className="flex flex-col gap-2">
              <label
                className="text-sm font-medium text-muted"
                htmlFor={`field-${field.field_id}`}
              >
                {field.label}
                {field.required && (
                  <Badge variant="warning" className="ml-2">
                    Required
                  </Badge>
                )}
              </label>

              {field.field_type === 'SELECT' ? (
                <select
                  id={`field-${field.field_id}`}
                  className="h-11 w-full rounded-sm border border-edge bg-surface-2 px-4 text-ink focus:border-brand-500 focus:outline-none"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Choose an option
                  </option>
                  {field.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`field-${field.field_id}`}
                  type={field.field_type === 'EMAIL' ? 'email' : 'text'}
                  className="h-11 w-full rounded-sm border border-edge bg-surface-2 px-4 text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
                  placeholder={field.label}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="md">
              Submit registration
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}

export default Registration
