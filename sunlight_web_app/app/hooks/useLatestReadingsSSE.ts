/*
 * useLatestReadingsSSE.ts
 *
 * React hook for Server-Sent Events connection to stream latest sensor readings.
 *
 * Copyright (c) 2025 Caden Howell (cadenhowell@gmail.com)
 * Developed with assistance from ChatGPT 4o (2025), Google Gemini 2.5 Pro (2025) and Claude Sonnet 4.5 (2025).
 * Apache 2.0 Licensed as described in the file LICENSE
 */

import { useState, useEffect, useRef } from 'react';

interface LatestReading {
    sensor_id: string;
    sensor_set_id: string;
    light_intensity: number | null;
    light_intensity_timestamp: string | null;
    battery_voltage: number | null;
    battery_percent: number | null;
    battery_percent_timestamp: string | null;
    wifi_dbm: number | null;
    wifi_dbm_timestamp: string | null;
    chip_temp_f: number | null;
    chip_temp_f_timestamp: string | null;
    last_seen: string | null;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseLatestReadingsSSEReturn {
    readings: LatestReading[];
    status: ConnectionStatus;
    error: string | null;
    lastUpdate: Date | null;
}

export function useLatestReadingsSSE(
    sensorSetId: string | null
): UseLatestReadingsSSEReturn {
    const [readings, setReadings] = useState<LatestReading[]>([]);
    const [status, setStatus] = useState<ConnectionStatus>('disconnected');
    const [error, setError] = useState<string | null>(null);
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Don't connect if no sensor set selected or if running on server
        if (!sensorSetId || typeof window === 'undefined') {
            setStatus('disconnected');
            setReadings([]);
            return;
        }

        const baseUrl = process.env.NEXT_PUBLIC_SSE_STREAM_URL;

        if (!baseUrl) {
            setError('SSE stream URL not configured');
            setStatus('error');
            return;
        }

        const url = `${baseUrl}?sensor_set_id=${sensorSetId}`;

        const connect = () => {
            // Clean up existing connection
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }

            setStatus('connecting');
            setError(null);

            const eventSource = new EventSource(url);
            eventSourceRef.current = eventSource;

            // Handle connection status
            eventSource.addEventListener('status', (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'connected') {
                        setStatus('connected');
                        setError(null);
                    } else if (data.type === 'timeout') {
                        // Server closed connection after timeout - reconnect
                        setStatus('connecting');
                        scheduleReconnect();
                    }
                } catch (e) {
                    console.error('Failed to parse status event:', e, event.data);
                }
            });

            // Handle data updates
            eventSource.addEventListener('update', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    setReadings(data.readings);
                    setLastUpdate(new Date());
                    setStatus('connected');
                } catch (e) {
                    console.error('Failed to parse update event:', e, event.data);
                }
            });

            // Handle heartbeats (keep connection alive indicator)
            eventSource.addEventListener('heartbeat', () => {
                // Connection is alive, no data changes
                setStatus('connected');
            });

            // Handle errors from server
            eventSource.addEventListener('error', (event) => {
                try {
                    const data = JSON.parse((event as MessageEvent).data);
                    console.warn('SSE error event:', data.message);
                    // Don't change status - server keeps connection open
                } catch (e) {
                    // Ignore - error events might not have data
                }
            });

            // Handle connection errors
            eventSource.onerror = () => {
                setStatus('error');
                setError('Connection lost. Reconnecting...');
                eventSource.close();
                scheduleReconnect();
            };
        };

        const scheduleReconnect = () => {
            // Clear any existing reconnect timeout
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }

            // Reconnect after 5 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
                connect();
            }, 5000);
        };

        // Initial connection
        connect();

        // Cleanup on unmount or when sensorSetId changes
        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }
        };
    }, [sensorSetId]);

    return {
        readings,
        status,
        error,
        lastUpdate,
    };
}