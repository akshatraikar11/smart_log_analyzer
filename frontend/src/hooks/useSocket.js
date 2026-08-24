/**
 * useSocket – React hook for real-time WebSocket events via Socket.IO
 *
 * Connects once, auto-reconnects, and provides:
 *   • connected   – boolean connection status
 *   • lastEvent   – the most recent event payload (any channel)
 *   • toasts      – array of anomaly toast notifications
 *   • dismissToast(id) – remove a toast
 *   • on(event, handler) / off(event, handler)
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

function getWsUrl() {
  let url = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  return url.replace(/\/api\/?$/, '');
}

const WS_URL = getWsUrl();

const TOAST_LIFETIME_MS = 8000
const MAX_TOASTS = 5

let nextToastId = 1

export default function useSocket() {
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState(null)
  const [toasts, setToasts] = useState([])

  // Stable dismiss helper
  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // ── Core event listeners ──────────────────────────────

    socket.on('log:new', (data) => {
      setLastEvent({ type: 'log:new', ...data })
    })

    socket.on('anomaly:new', (data) => {
      setLastEvent({ type: 'anomaly:new', ...data })

      // Create a toast notification for anomalies
      const id = nextToastId++
      const toast = {
        id,
        type: 'anomaly',
        severity: data.log?.severity || 'UNKNOWN',
        source: data.log?.source || '—',
        eventType: data.log?.eventType || data.log?.event_type || '—',
        score: data.detection?.score ?? 0,
        algorithm: data.detection?.algorithm || '—',
        reason: data.detection?.reason || '',
        createdAt: Date.now(),
      }

      setToasts((prev) => {
        const next = [toast, ...prev]
        return next.slice(0, MAX_TOASTS)
      })

      // Auto-dismiss after TOAST_LIFETIME_MS
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, TOAST_LIFETIME_MS)
    })

    socket.on('stats:update', (data) => {
      setLastEvent({ type: 'stats:update', ...data })
    })

    socket.on('ai:complete', (data) => {
      setLastEvent({ type: 'ai:complete', ...data })
    })

    // ──────────────────────────────────────────────────────

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  // Expose on/off for custom listeners
  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler)
  }, [])

  const off = useCallback((event, handler) => {
    socketRef.current?.off(event, handler)
  }, [])

  return { connected, lastEvent, toasts, dismissToast, on, off }
}
