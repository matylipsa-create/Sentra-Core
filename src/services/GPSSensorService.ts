/**
 * GPSSensorService — Sensor GPS usando la Geolocation API del navegador.
 *
 * Implementa la interfaz Sensor del SensorHub, publicando lecturas
 * con coordenadas, precision, altitud, velocidad y rumbo.
 */

import {
  type Sensor,
  type SensorDescriptor,
  type SensorStatus,
  type SensorReading,
  type LocationReading,
} from "../core/SensorHub";

class GPSSensor implements Sensor {
  private status: SensorStatus = "offline";
  private lastReading: SensorReading<LocationReading> | null = null;
  private running = false;
  private watchId: number | null = null;

  readonly descriptor = {
    id: "gps-native",
    name: "GPS Nativo",
    category: "location" as const,
    unit: "lat/lon",
    location: "Dispositivo",
    sampleRateHz: 1,
  };

  getStatus(): SensorStatus {
    return this.status;
  }

  getDescriptor(): SensorDescriptor {
    return {
      ...this.descriptor,
      status: this.status,
      lastReading: this.lastReading,
    };
  }

  isRunning(): boolean {
    return this.running;
  }

  getLastReading(): SensorReading<LocationReading> | null {
    return this.lastReading;
  }

  start(): void {
    if (this.running) return;
    if (!("geolocation" in navigator)) {
      this.status = "error";
      return;
    }
    this.running = true;
    this.status = "online";

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.status = "online";
        this.lastReading = {
          sensorId: this.descriptor.id,
          category: "location",
          timestamp: Date.now(),
          value: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
          },
          unit: this.descriptor.unit,
          confidence: Math.min(1, 50 / Math.max(pos.coords.accuracy, 5)),
        };
      },
      () => {
        this.status = "warning";
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  stop(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.running = false;
    this.status = "offline";
  }
}

/** Devuelve true si el navegador soporta geolocation. */
export function isGPSSupported(): boolean {
  return "geolocation" in navigator;
}

/** Crea el sensor GPS nativo, o null si no hay soporte. */
export function createGPSSensor(): Sensor | null {
  if (!isGPSSupported()) return null;
  return new GPSSensor();
}
