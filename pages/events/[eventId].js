import React, { useEffect, useState, useContext } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { AuthContext } from '../../components/authContext'
import { soloEventRegistrationNew } from '../../components/Event Registration/soloEventRegistration'
import { ToastContainer, toast } from 'react-toastify'
import styles from '../../styles/event-details.module.css'

const IST = { timeZone: 'Asia/Kolkata' }

const formatDay = (date) =>
    date.toLocaleDateString('en-IN', { ...IST, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

const formatTime = (date) =>
    date.toLocaleTimeString('en-IN', { ...IST, hour: 'numeric', minute: '2-digit' })

const getSchedule = (start, end) => {
    const startDate = start ? new Date(start) : null
    if (!startDate || Number.isNaN(startDate.getTime())) return null
    const endDate = end ? new Date(end) : null
    if (!endDate || Number.isNaN(endDate.getTime())) {
        return { date: formatDay(startDate), time: formatTime(startDate) }
    }
    if (formatDay(startDate) === formatDay(endDate)) {
        return { date: formatDay(startDate), time: `${formatTime(startDate)} – ${formatTime(endDate)}` }
    }
    return { date: `${formatDay(startDate)} – ${formatDay(endDate)}`, time: `${formatTime(startDate)} onwards` }
}

const formatPrize = (prize) => {
    const value = String(prize ?? '').trim()
    if (!value || value === '0') return null
    if (/^\d[\d,]*$/.test(value)) return `₹${Number(value.replace(/,/g, '')).toLocaleString('en-IN')}`
    return value
}

const getTeamSize = (event) => {
    if (!event.max_team_size) return null
    if (event.max_team_size === 1) return 'Individual'
    if (event.min_team_size === event.max_team_size) return `${event.max_team_size} members`
    return `${event.min_team_size || 1} – ${event.max_team_size} members`
}

const getOrganizers = (organizer) => {
    if (!organizer) return []
    const entries = Array.isArray(organizer) ? organizer : String(organizer).split(',')
    return entries
        .map((entry) => (Array.isArray(entry) ? entry : String(entry).split(':')))
        .map(([name, phone]) => ({ name: String(name || '').trim(), phone: String(phone || '').trim() }))
        .filter((person) => person.name)
}

const EventDetailsPage = () => {
    const router = useRouter()
    const { eventId } = router.query
    const userData = useContext(AuthContext)
    const [event, setEvent] = useState(null)
    const [loading, setLoading] = useState(true)

    const host = process.env.NEXT_PUBLIC_HOST || '/api/backend'
    const mediaBase = process.env.NEXT_PUBLIC_MEDIA_BASE || host

    const makePosterUrl = (url) => {
        if (!url) return '/events/poster.png'
        if (url.startsWith('http://') || url.startsWith('https://')) return url
        if (
            url === '/events/poster.png' ||
            url === '/events/poster1.png' ||
            url === 'events/poster.png' ||
            url === 'events/poster1.png' ||
            url.startsWith('/images/') ||
            url.startsWith('/pics/') ||
            url.startsWith('/home/') ||
            url.startsWith('/assets/') ||
            url.startsWith('/multicity/')
        ) {
            return url.startsWith('/') ? url : `/${url}`
        }
        const base = (mediaBase || '').replace(/\/$/, '')
        const path = url.startsWith('/') ? url : `/${url}`
        return `${base}${path}`
    }

    useEffect(() => {
        if (!eventId) return
        
        const fetchEvent = async () => {
            try {
                // First try to fetch all events and find the specific one
                const res = await fetch(`${host}/events`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                })
                const data = await res.json()
                const eventsArray = Array.isArray(data) ? data : (data.events || [])
                let foundEvent = eventsArray.find(e => e.id === eventId || e._id === eventId)
                
                if (!foundEvent) {
                    // Try special events
                    const specialRes = await fetch(`${host}/events/special`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    })
                    const specialData = await specialRes.json()
                    const specialList = Array.isArray(specialData) ? specialData : (specialData.events || specialData.special_events || specialData.specialEvents || specialData.data || [])
                    foundEvent = specialList.find(e => e.id === eventId || e._id === eventId)
                }

                if (!foundEvent) {
                    // Try single event endpoint directly
                    const singleRes = await fetch(`${host}/events/${eventId}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                    })
                    if (singleRes.ok) {
                        const singleData = await singleRes.json()
                        foundEvent = singleData.event || singleData.data || singleData
                    }
                }

                if (foundEvent) {
                    let resolvedPoster = ''
                    const candidatePoster = foundEvent.poster_url || foundEvent.poster || foundEvent.poster_file
                    if (candidatePoster && (candidatePoster.startsWith('http://') || candidatePoster.startsWith('https://'))) {
                        resolvedPoster = candidatePoster
                    } else if (
                        candidatePoster &&
                        (candidatePoster === '/events/poster.png' ||
                         candidatePoster === '/events/poster1.png' ||
                         candidatePoster === 'events/poster.png' ||
                         candidatePoster === 'events/poster1.png' ||
                         candidatePoster.startsWith('/images/') ||
                         candidatePoster.startsWith('/pics/') ||
                         candidatePoster.startsWith('/home/') ||
                         candidatePoster.startsWith('/assets/') ||
                         candidatePoster.startsWith('/multicity/'))
                    ) {
                        resolvedPoster = candidatePoster.startsWith('/') ? candidatePoster : `/${candidatePoster}`
                    } else if (candidatePoster) {
                        // S3 key (e.g. events/EVT-...) - fetch the signed URL
                        try {
                            const targetId = foundEvent.id || foundEvent._id || eventId
                            const posterRes = await fetch(`${host}/events/${targetId}/poster`)
                            if (posterRes.ok) {
                                const posterData = await posterRes.json()
                                if (posterData?.success && posterData?.url) {
                                    resolvedPoster = posterData.url
                                }
                            }
                        } catch (err) {
                            console.error('Failed to fetch poster URL', err)
                        }
                    }

                    if (!resolvedPoster) {
                        resolvedPoster = makePosterUrl(candidatePoster)
                    }

                    setEvent({
                        ...foundEvent,
                        poster: resolvedPoster,
                        poster_url: resolvedPoster,
                        name: foundEvent.name || foundEvent["Event Name"] || '',
                    })
                }
            } catch (e) {
                console.error('Failed to fetch event', e)
            } finally {
                setLoading(false)
            }
        }
        
        fetchEvent()
    }, [eventId, host])

    const [isRegistering, setIsRegistering] = useState(false)
    const [registrationResult, setRegistrationResult] = useState(null)

    async function handleRagister() {
        if (isRegistering) return

        if (userData.isAuth) {
            setIsRegistering(true)
            try {
                if (event.is_active !== false) {
                    const isSolo = event.is_solo || (event.max_team_size === 1 && event.min_team_size === 1) || event.max_team_size === 1;
                    if (isSolo) {
                        const result = await soloEventRegistrationNew(
                            event.id || event._id,
                            router,
                            () => {} // closeHandler equivalent
                        )
                        if (result && !result.openedGateway) {
                            setRegistrationResult(result)
                        }
                    } else {
                        await router.push({
                            pathname: `/event-registration/${event.id || event._id}`,
                            query: {
                                id: event.id || event._id,
                                name: event.name,
                                description: event.description,
                                max_team_size: event.max_team_size,
                                min_team_size: event.min_team_size,
                                registration_fee: event.registration_fee,
                                user_type: userData.state?.user?.user_type || '',
                                tags: event.tags,
                            },
                        })
                    }
                } else {
                    toast.info('Registration Closed !')
                }
            } catch (error) {
                console.error(error)
                toast.error('Something went wrong')
            } finally {
                setIsRegistering(false)
            }
        } else {
            router.push(`/userLogin?callbackUrl=${encodeURIComponent(router.asPath)}`)
        }
    }

    if (loading) {
        return (
            <div className={styles.eventPage}>
                <div className={styles.state}>
                    <span className={styles.spinner} aria-hidden="true" />
                    Loading event…
                </div>
            </div>
        )
    }

    if (!event) {
        return (
            <div className={styles.eventPage}>
                <div className={styles.state}>
                    <h1>Event not found</h1>
                    <p>This event may have been moved or is no longer available.</p>
                    <button className={styles.secondaryButton} onClick={() => router.push('/events')}>
                        Browse all events
                    </button>
                </div>
            </div>
        )
    }

    const description = (event.description || '').replace(/\\n/g, '<br />')
    const title = (event.name || '').split('#')[0]
    const schedule = getSchedule(event.start_time, event.end_time)
    const venue = event.venue || event.Venue
    const teamSize = getTeamSize(event)
    const prize = formatPrize(event.prize)
    const fee = Number(event.registration_fee) > 0 ? `₹${Number(event.registration_fee).toLocaleString('en-IN')}` : 'Free'
    const deadline = event.registration_deadline ? new Date(event.registration_deadline) : null
    const hasDeadline = Boolean(deadline) && !Number.isNaN(deadline.getTime())
    const registrationClosed = event.is_active === false || (hasDeadline && Date.now() > deadline.getTime())
    const organizers = getOrganizers(event.organizer)
    const mediaLabel = event.video && /youtu/i.test(event.video) ? 'Watch trailer' : 'Rulebook'
    const isPaymentPending = Boolean(registrationResult) && (
        registrationResult.payment_required ||
        String(registrationResult.payment_status || '').toUpperCase() === 'PENDING'
    )

    const chips = [
        event.is_special && event.special_event_type && event.special_event_type !== 'OTHER'
            ? event.special_event_type.replace(/_/g, ' ')
            : null,
        ...(Array.isArray(event.tags) ? event.tags.map((tag) => String(tag).replace(/_/g, ' ')) : []),
        event.is_online ? 'Online' : 'On campus',
    ].filter(Boolean)

    const facts = [
        schedule && { label: 'Date', value: schedule.date },
        schedule && { label: 'Time', value: schedule.time },
        !schedule && event.Date && { label: 'Date', value: event.Date },
        !schedule && event.Time && { label: 'Time', value: event.Time },
        venue && { label: 'Venue', value: venue },
        teamSize && { label: 'Team size', value: teamSize },
        prize && { label: 'Prizes', value: prize },
    ].filter(Boolean)

    return (
        <>
            <Head>
                <title>{`${title} - Anwesha 2027`}</title>
                <link
                    href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div className={styles.eventPage}>
                <div className={styles.eventShell}>
                    <button className={styles.backLink} onClick={() => router.push('/events')}>
                        ← All events
                    </button>

                    <header className={styles.hero}>
                        <p className={styles.eyebrow}>Anwesha 2027 · Event details</p>
                        <h1 className={styles.eventTitle}>{title}</h1>
                        {chips.length > 0 && (
                            <ul className={styles.chips}>
                                {chips.map((chip) => (
                                    <li key={chip} className={styles.chip}>{chip}</li>
                                ))}
                            </ul>
                        )}
                    </header>

                    {registrationResult ? (
                        <div className={`${styles.resultCard} ${isPaymentPending ? styles.resultPending : styles.resultSuccess}`}>
                            <h2>{isPaymentPending ? 'Complete your payment' : '✓ You are registered'}</h2>
                            {isPaymentPending ? (
                                <>
                                    {Number(registrationResult.amount_due) > 0 && (
                                        <p className={styles.resultAmount}>Amount due: ₹{registrationResult.amount_due}</p>
                                    )}
                                    <p>Your spot is reserved until the payment is done. You can also pay later from your profile.</p>
                                </>
                            ) : (
                                <p>You have successfully registered for {title || 'this event'}. See you there!</p>
                            )}
                            <div className={styles.resultActions}>
                                <button className={styles.registerButton} onClick={() => router.push('/profile')}>
                                    Go to profile
                                </button>
                                <button className={styles.secondaryButton} onClick={() => setRegistrationResult(null)}>
                                    Back to event
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className={styles.eventBody}>
                            <aside className={styles.sidebar}>
                                <img
                                    src={event.poster || event.poster_url || '/events/poster.png'}
                                    alt={`${title} poster`}
                                    className={styles.poster}
                                    onError={(e) => {
                                        const targetId = event.id || event._id || eventId;
                                        if (targetId && !e.target.dataset.retried) {
                                            e.target.dataset.retried = 'true';
                                            fetch(`${host}/events/${targetId}/poster?fresh=true`)
                                                .then(r => r.json())
                                                .then(data => {
                                                    if (data?.success && data?.url) {
                                                        e.target.src = data.url;
                                                    } else {
                                                        e.target.src = '/events/poster.png';
                                                    }
                                                })
                                                .catch(() => {
                                                    e.target.src = '/events/poster.png';
                                                });
                                        } else if (e.target.src !== '/events/poster.png') {
                                            e.target.src = '/events/poster.png';
                                        }
                                    }}
                                />

                                <div className={styles.registerCard}>
                                    <div className={styles.feeRow}>
                                        <span>Entry fee</span>
                                        <strong>{fee}</strong>
                                    </div>
                                    {hasDeadline && (
                                        <p className={styles.deadline}>
                                            {registrationClosed ? 'Registration closed on ' : 'Register by '}
                                            {formatDay(deadline)}
                                        </p>
                                    )}
                                    <button
                                        className={styles.registerButton}
                                        onClick={handleRagister}
                                        disabled={isRegistering || registrationClosed}
                                    >
                                        {registrationClosed ? 'Registration closed' : isRegistering ? 'Processing…' : 'Register now'}
                                    </button>
                                    {event.video && (
                                        <a className={styles.secondaryButton} target="_blank" rel="noreferrer" href={event.video}>
                                            {mediaLabel}
                                        </a>
                                    )}
                                </div>
                            </aside>

                            <div className={styles.eventInfo}>
                                {facts.length > 0 && (
                                    <dl className={styles.facts}>
                                        {facts.map((fact) => (
                                            <div key={fact.label} className={styles.fact}>
                                                <dt>{fact.label}</dt>
                                                <dd>{fact.value}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                )}

                                {description && (
                                    <section className={styles.section}>
                                        <h2>About the event</h2>
                                        <div className={styles.description} dangerouslySetInnerHTML={{ __html: description }} />
                                    </section>
                                )}

                                {organizers.length > 0 && (
                                    <section className={styles.section}>
                                        <h2>Contact the organisers</h2>
                                        <ul className={styles.organizers}>
                                            {organizers.map((person) => (
                                                <li key={`${person.name}-${person.phone}`} className={styles.organizer}>
                                                    <span className={styles.avatar} aria-hidden="true">
                                                        {person.name.charAt(0).toUpperCase()}
                                                    </span>
                                                    <div>
                                                        <p className={styles.organizerName}>{person.name}</p>
                                                        {person.phone && (
                                                            <a className={styles.organizerPhone} href={`tel:${person.phone}`}>
                                                                {person.phone}
                                                            </a>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                            </div>
                        </div>
                    )}
                </div>
                <ToastContainer />
            </div>
        </>
    )
}

export default EventDetailsPage
