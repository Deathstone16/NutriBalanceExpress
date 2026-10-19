-- Un horario cancelado puede reutilizarse; todos los turnos activos duran 30 min.
CREATE UNIQUE INDEX appointments_active_slot_unique ON appointments (starts_at)
WHERE status <> 'cancelled';

ALTER TABLE appointments ADD CONSTRAINT appointments_duration_check CHECK (ends_at = starts_at + INTERVAL '30 minutes');
ALTER TABLE appointments ADD CONSTRAINT appointments_patient_check CHECK (status NOT IN ('confirmed', 'attended') OR patient_id IS NOT NULL);
ALTER TABLE consultations ADD CONSTRAINT consultations_weight_check CHECK (weight_kg IS NULL OR (weight_kg > 0 AND weight_kg <= 500));
ALTER TABLE consultations ADD CONSTRAINT consultations_height_check CHECK (height_cm IS NULL OR (height_cm > 0 AND height_cm <= 250));
ALTER TABLE consultations ADD CONSTRAINT consultations_waist_check CHECK (waist_cm IS NULL OR (waist_cm > 0 AND waist_cm <= 300));

-- Formato requerido por connect-pg-simple; las sesiones NO son recursos de la API.
CREATE TABLE sessions (
  sid varchar NOT NULL PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX sessions_expire_idx ON sessions (expire);
