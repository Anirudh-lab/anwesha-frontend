import React, { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import { toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { AuthContext } from '../components/authContext'
import styles from '../styles/profile.module.css'
import {
    requestUploadUrl,
    submitIdCard,
    uploadFileToS3,
    validateIdFile,
} from '../lib/idVerification'

/**
 * Task 4 — Student Dual Document Verification (College ID + Aadhar ID).
 * Route: /submit-id?token=xxx (token comes from verification email).
 */
export default function SubmitId() {
    const router = useRouter()
    const auth = useContext(AuthContext)

    const [emailToken, setEmailToken] = useState('')

    // College ID state
    const [collegeIdNumber, setCollegeIdNumber] = useState('')
    const [collegeIdFile, setCollegeIdFile] = useState(null)
    const [dragActiveCollege, setDragActiveCollege] = useState(false)

    // Aadhar ID state
    const [aadharIdNumber, setAadharIdNumber] = useState('')
    const [aadharIdFile, setAadharIdFile] = useState(null)
    const [dragActiveAadhar, setDragActiveAadhar] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [submittingStep, setSubmittingStep] = useState('')
    const [submitted, setSubmitted] = useState(false) // UPLOADED / pending-review
    const [verifiedStatus, setVerifiedStatus] = useState(null)
    const [formError, setFormError] = useState('')

    // Ensure user is logged in before allowing access to this page
    useEffect(() => {
        if (!router.isReady) return
        const storedToken =
            typeof window !== 'undefined'
                ? localStorage.getItem('anwesha_token')
                : null
        if (!auth?.token && !storedToken) {
            router.replace(
                `/userLogin?callbackUrl=${encodeURIComponent(router.asPath)}`
            )
        }
    }, [router.isReady, auth?.token, router.asPath, router])

    // Step 1: read verification token from query params
    useEffect(() => {
        if (!router.isReady) return
        const t = router.query?.token
        if (typeof t === 'string' && t) {
            setEmailToken(t)
        }
    }, [router.isReady, router.query?.token, router])

    // Surface existing verification state from profile (UPLOADED / VERIFIED)
    useEffect(() => {
        const u = auth?.state?.user
        const s = u?.id_card_status || u?.idCardStatus || u?.id_card?.status
        if (s) setVerifiedStatus(String(s).toUpperCase())
    }, [auth?.state?.user])

    const handleFileChangeCollege = (e) => {
        const f = e.target.files?.[0] || null
        setCollegeIdFile(f)
        setFormError('')
    }

    const handleDragCollege = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActiveCollege(true)
        } else if (e.type === 'dragleave') {
            setDragActiveCollege(false)
        }
    }

    const handleDropCollege = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActiveCollege(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setCollegeIdFile(e.dataTransfer.files[0])
            setFormError('')
        }
    }

    const handleFileChangeAadhar = (e) => {
        const f = e.target.files?.[0] || null
        setAadharIdFile(f)
        setFormError('')
    }

    const handleDragAadhar = (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActiveAadhar(true)
        } else if (e.type === 'dragleave') {
            setDragActiveAadhar(false)
        }
    }

    const handleDropAadhar = (e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragActiveAadhar(false)
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            setAadharIdFile(e.dataTransfer.files[0])
            setFormError('')
        }
    }

    const notify = (type, msg) => {
        if (type === 'success') toast.success(msg)
        else if (type === 'warn') toast.warning(msg)
        else toast.error(msg)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (submitting || submitted) return // prevent duplicates
        setFormError('')

        if (!emailToken) {
            const msg = 'Invalid token. Please use the link from your email.'
            setFormError(msg)
            notify('error', msg)
            return
        }
        if (!auth?.token) {
            const msg = 'Please login to submit your ID.'
            setFormError(msg)
            notify('error', msg)
            router.push(`/userLogin?callbackUrl=${encodeURIComponent(router.asPath)}`)
            return
        }

        // College ID Validation
        if (!collegeIdNumber.trim()) {
            const msg = 'Please enter your College / Student ID number.'
            setFormError(msg)
            notify('error', msg)
            return
        }
        const collegeFileErr = validateIdFile(collegeIdFile, 'college_id')
        if (collegeFileErr) {
            const msg = `College ID: ${collegeFileErr}`
            setFormError(msg)
            notify('error', msg)
            return
        }

        // Aadhar ID Validation
        const cleanAadhar = aadharIdNumber.replace(/[\s-]/g, '')
        if (!cleanAadhar) {
            const msg = 'Please enter your Aadhar Card number.'
            setFormError(msg)
            notify('error', msg)
            return
        }
        if (!/^\d{12}$/.test(cleanAadhar)) {
            const msg = 'Aadhar number must be a valid 12-digit number.'
            setFormError(msg)
            notify('error', msg)
            return
        }
        const aadharFileErr = validateIdFile(aadharIdFile, 'aadhar_id')
        if (aadharFileErr) {
            const msg = `Aadhar Card: ${aadharFileErr}`
            setFormError(msg)
            notify('error', msg)
            return
        }

        if (verifiedStatus === 'VERIFIED') {
            const msg = 'ID already verified. Profile updates are blocked.'
            setFormError(msg)
            notify('warn', msg)
            return
        }

        setSubmitting(true)
        try {
            // Step 1: Upload College ID
            setSubmittingStep('Uploading College ID (1/2)...')
            const collegeUrlData = await requestUploadUrl({
                file: collegeIdFile,
                jwt: auth.token,
                emailToken,
                doc_type: 'college_id',
            })
            await uploadFileToS3({
                uploadUrl: collegeUrlData.uploadUrl,
                file: collegeIdFile,
            })

            // Step 2: Upload Aadhar ID
            setSubmittingStep('Uploading Aadhar Card (2/2)...')
            const aadharUrlData = await requestUploadUrl({
                file: aadharIdFile,
                jwt: auth.token,
                emailToken,
                doc_type: 'aadhar_id',
            })
            await uploadFileToS3({
                uploadUrl: aadharUrlData.uploadUrl,
                file: aadharIdFile,
            })

            // Step 3: Final submit
            setSubmittingStep('Submitting verification documents...')
            const data = await submitIdCard({
                emailToken,
                college_id_number: collegeIdNumber.trim(),
                college_id_file_key: collegeUrlData.fileKey,
                aadhar_id_number: cleanAadhar,
                aadhar_id_file_key: aadharUrlData.fileKey,
                jwt: auth.token,
            })

            setSubmitted(true)
            setVerifiedStatus('UPLOADED')
            const okMsg =
                data?.message ||
                'College ID and Aadhar Card submitted successfully and are pending review.'
            notify('success', okMsg)
            if (auth?.getUser) auth.getUser()
        } catch (err) {
            const msg = err?.message || 'Submission failed. Please try again.'
            setFormError(msg)
            notify('error', msg)
            if (err?.code === 401) {
                router.push(`/userLogin?callbackUrl=${encodeURIComponent(router.asPath)}`)
            }
        } finally {
            setSubmitting(false)
            setSubmittingStep('')
        }
    }

    const isTokenMissingOrInvalid = (!emailToken && router.isReady) || formError === 'Invalid token.'

    return (
        <>
            <Head>
                <title>Submit Verification Documents - Anwesha 2k27</title>
                <meta name="description" content="Student ID & Aadhar Verification - Anwesha 2k27" />
            </Head>
            {/* Toasts render via the global ToastContainer in _app.js */}
            <div className={styles.mainContainer}>
                <div className={styles.subContainer}>
                    <div
                        style={{
                            position: 'relative',
                            zIndex: 1,
                            maxWidth: 860,
                            margin: '40px auto',
                            padding: '40px 32px',
                            background: 'rgba(0,0,0,0.78)',
                            border: '1px solid #F2BF51',
                            borderRadius: 16,
                            backdropFilter: 'blur(10px)',
                            boxShadow: '0 8px 32px rgba(242, 191, 81, 0.15)',
                        }}
                    >
                        <h1
                            style={{
                                color: '#F2BF51',
                                marginBottom: 10,
                                fontSize: '2.3rem',
                                textAlign: 'center',
                                textTransform: 'uppercase',
                                letterSpacing: '2px',
                            }}
                        >
                            Document Verification
                        </h1>
                        <p style={{ color: '#ccc', marginBottom: 28, fontSize: '1.05rem', textAlign: 'center' }}>
                            {submitted || verifiedStatus === 'UPLOADED'
                                ? 'Your documents are submitted and pending review by the team.'
                                : verifiedStatus === 'VERIFIED'
                                ? 'Your documents have been verified.'
                                : 'Please provide both your College ID and Aadhar ID for identity verification.'}
                        </p>

                        {isTokenMissingOrInvalid ? (
                            <div
                                style={{
                                    textAlign: 'center',
                                    padding: '40px 20px',
                                    background: 'rgba(255, 0, 0, 0.1)',
                                    borderRadius: '10px',
                                    border: '1px solid #ff8888',
                                }}
                            >
                                <svg
                                    style={{ width: 64, height: 64, color: '#ff8888', margin: '0 auto 16px' }}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                </svg>
                                <h2 style={{ color: '#ff8888', marginBottom: 12 }}>
                                    Invalid or Missing Verification Token
                                </h2>
                                <p style={{ color: '#fff', fontSize: '1.1rem' }}>
                                    Please open the secure verification link provided in the email sent to your account.
                                </p>
                            </div>
                        ) : (
                            <>
                                {formError && (
                                    <div
                                        style={{
                                            background: 'rgba(255, 0, 0, 0.1)',
                                            border: '1px solid #ff8888',
                                            padding: '16px',
                                            borderRadius: 8,
                                            marginBottom: 24,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <p style={{ color: '#ff8888', margin: 0, fontWeight: '500', fontSize: '1.05rem' }}>
                                            {formError}
                                        </p>
                                    </div>
                                )}

                                {submitted && !formError && (
                                    <div
                                        style={{
                                            background: 'rgba(0, 255, 0, 0.1)',
                                            border: '1px solid #4caf50',
                                            padding: '16px',
                                            borderRadius: 8,
                                            marginBottom: 24,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <p style={{ color: '#4caf50', margin: 0, fontWeight: '500', fontSize: '1.1rem' }}>
                                            Documents submitted successfully!
                                        </p>
                                    </div>
                                )}

                                {submitted || verifiedStatus === 'VERIFIED' || verifiedStatus === 'UPLOADED' ? (
                                    <div style={{ color: '#fff', textAlign: 'center', padding: '20px' }}>
                                        <p style={{ fontSize: '1.2rem' }}>
                                            Status:{' '}
                                            <strong style={{ color: '#F2BF51', fontSize: '1.4rem' }}>
                                                {submitted ? 'UPLOADED (pending review)' : verifiedStatus}
                                            </strong>
                                        </p>
                                        <p style={{ marginTop: 12, color: '#ccc', fontSize: '1rem' }}>
                                            Uploading again does not mean verified. Please wait for the team review.
                                        </p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                                        {/* DOCUMENT 1: COLLEGE ID */}
                                        <div
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(242, 191, 81, 0.35)',
                                                borderRadius: 12,
                                                padding: '24px 20px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                                <span
                                                    style={{
                                                        background: '#F2BF51',
                                                        color: '#000',
                                                        fontWeight: 'bold',
                                                        borderRadius: '50%',
                                                        width: 28,
                                                        height: 28,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.95rem',
                                                    }}
                                                >
                                                    1
                                                </span>
                                                <h2 style={{ color: '#F2BF51', margin: 0, fontSize: '1.35rem' }}>
                                                    College ID Card
                                                </h2>
                                            </div>
                                            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 18 }}>
                                                Upload your current college student ID card or bonafide certificate.
                                            </p>

                                            <div style={{ marginBottom: 18 }}>
                                                <label style={{ color: '#F2BF51', fontSize: '1rem', fontWeight: 'bold' }}>
                                                    College Roll / Student ID Number *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={collegeIdNumber}
                                                    onChange={(ev) => setCollegeIdNumber(ev.target.value)}
                                                    placeholder="e.g. 2201CS01 or STU-9842"
                                                    disabled={submitting}
                                                    style={{
                                                        width: '100%',
                                                        padding: '13px',
                                                        marginTop: 8,
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid #333',
                                                        borderRadius: '8px',
                                                        fontSize: '1rem',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ color: '#F2BF51', fontSize: '1rem', fontWeight: 'bold' }}>
                                                    College ID Document *{' '}
                                                    <span style={{ color: '#999', fontWeight: 'normal', fontSize: '0.85rem' }}>
                                                        (PNG, JPG, JPEG, max 5MB)
                                                    </span>
                                                </label>
                                                <div
                                                    onDragEnter={handleDragCollege}
                                                    onDragLeave={handleDragCollege}
                                                    onDragOver={handleDragCollege}
                                                    onDrop={handleDropCollege}
                                                    style={{
                                                        marginTop: 8,
                                                        padding: '30px 18px',
                                                        border: dragActiveCollege ? '2px dashed #F2BF51' : '2px dashed #444',
                                                        background: dragActiveCollege ? 'rgba(242, 191, 81, 0.1)' : '#111',
                                                        borderRadius: '10px',
                                                        textAlign: 'center',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    <input
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg"
                                                        onChange={handleFileChangeCollege}
                                                        disabled={submitting}
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            opacity: 0,
                                                            cursor: 'pointer',
                                                        }}
                                                    />
                                                    <svg
                                                        style={{ width: 40, height: 40, color: '#F2BF51', margin: '0 auto 10px' }}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                                        />
                                                    </svg>
                                                    {collegeIdFile ? (
                                                        <p style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>
                                                            <strong style={{ color: '#F2BF51' }}>Selected:</strong> {collegeIdFile.name} (
                                                            {Math.round(collegeIdFile.size / 1024)} KB)
                                                        </p>
                                                    ) : (
                                                        <p style={{ color: '#bbb', fontSize: '0.95rem', margin: 0 }}>
                                                            Drag & drop College ID <strong style={{ color: '#F2BF51' }}>image (PNG, JPG, JPEG)</strong> here, or click to browse
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* DOCUMENT 2: AADHAR CARD */}
                                        <div
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.03)',
                                                border: '1px solid rgba(242, 191, 81, 0.35)',
                                                borderRadius: 12,
                                                padding: '24px 20px',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                                <span
                                                    style={{
                                                        background: '#F2BF51',
                                                        color: '#000',
                                                        fontWeight: 'bold',
                                                        borderRadius: '50%',
                                                        width: 28,
                                                        height: 28,
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '0.95rem',
                                                    }}
                                                >
                                                    2
                                                </span>
                                                <h2 style={{ color: '#F2BF51', margin: 0, fontSize: '1.35rem' }}>
                                                    Aadhar Card
                                                </h2>
                                            </div>
                                            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 18 }}>
                                                Upload your official 12-digit Aadhar identity card.
                                            </p>

                                            <div style={{ marginBottom: 18 }}>
                                                <label style={{ color: '#F2BF51', fontSize: '1rem', fontWeight: 'bold' }}>
                                                    Aadhar Number (12 digits) *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={aadharIdNumber}
                                                    onChange={(ev) => setAadharIdNumber(ev.target.value)}
                                                    placeholder="e.g. 1234 5678 9012"
                                                    maxLength={14}
                                                    disabled={submitting}
                                                    style={{
                                                        width: '100%',
                                                        padding: '13px',
                                                        marginTop: 8,
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid #333',
                                                        borderRadius: '8px',
                                                        fontSize: '1rem',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>

                                            <div>
                                                <label style={{ color: '#F2BF51', fontSize: '1rem', fontWeight: 'bold' }}>
                                                    Aadhar Document *{' '}
                                                    <span style={{ color: '#999', fontWeight: 'normal', fontSize: '0.85rem' }}>
                                                        (PDF only, max 5MB)
                                                    </span>
                                                </label>
                                                <div
                                                    onDragEnter={handleDragAadhar}
                                                    onDragLeave={handleDragAadhar}
                                                    onDragOver={handleDragAadhar}
                                                    onDrop={handleDropAadhar}
                                                    style={{
                                                        marginTop: 8,
                                                        padding: '30px 18px',
                                                        border: dragActiveAadhar ? '2px dashed #F2BF51' : '2px dashed #444',
                                                        background: dragActiveAadhar ? 'rgba(242, 191, 81, 0.1)' : '#111',
                                                        borderRadius: '10px',
                                                        textAlign: 'center',
                                                        transition: 'all 0.2s ease',
                                                        cursor: 'pointer',
                                                        position: 'relative',
                                                    }}
                                                >
                                                    <input
                                                        type="file"
                                                        accept="application/pdf"
                                                        onChange={handleFileChangeAadhar}
                                                        disabled={submitting}
                                                        style={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            width: '100%',
                                                            height: '100%',
                                                            opacity: 0,
                                                            cursor: 'pointer',
                                                        }}
                                                    />
                                                    <svg
                                                        style={{ width: 40, height: 40, color: '#F2BF51', margin: '0 auto 10px' }}
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                        xmlns="http://www.w3.org/2000/svg"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                                        />
                                                    </svg>
                                                    {aadharIdFile ? (
                                                        <p style={{ color: '#fff', fontSize: '1rem', margin: 0 }}>
                                                            <strong style={{ color: '#F2BF51' }}>Selected:</strong> {aadharIdFile.name} (
                                                            {Math.round(aadharIdFile.size / 1024)} KB)
                                                        </p>
                                                    ) : (
                                                        <p style={{ color: '#bbb', fontSize: '0.95rem', margin: 0 }}>
                                                            Drag & drop Aadhar <strong style={{ color: '#F2BF51' }}>PDF</strong> here, or click to browse
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={submitting || !emailToken || !auth?.token}
                                            style={{
                                                padding: '16px 24px',
                                                background: submitting
                                                    ? '#666'
                                                    : 'linear-gradient(90deg, #F2BF51 0%, #d49c25 100%)',
                                                color: '#000',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: submitting ? 'not-allowed' : 'pointer',
                                                fontWeight: 'bold',
                                                fontSize: '1.2rem',
                                                marginTop: '6px',
                                                boxShadow: submitting ? 'none' : '0 4px 15px rgba(242, 191, 81, 0.4)',
                                                transition: 'transform 0.1s ease',
                                            }}
                                            onMouseDown={(e) => {
                                                if (!submitting) e.currentTarget.style.transform = 'scale(0.98)'
                                            }}
                                            onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                        >
                                            {submitting ? (submittingStep || 'Submitting...') : 'Submit Documents for Review'}
                                        </button>
                                        <p style={{ textAlign: 'center', color: '#888', fontSize: '0.85rem', margin: 0 }}>
                                            Both documents are securely uploaded and verified by authorized Anwesha administrators.
                                        </p>
                                    </form>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
