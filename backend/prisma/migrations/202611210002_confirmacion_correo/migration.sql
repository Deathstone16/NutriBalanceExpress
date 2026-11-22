-- Confirmación del turno por correo: la solicitud queda "pendiente" hasta que la persona
-- abre el enlace que recibe. El token se guarda solo como hash SHA-256.
ALTER TABLE appointments
  ADD COLUMN contact_email_confirmed_at TIMESTAMPTZ(3),
  ADD COLUMN confirmation_token_hash VARCHAR(64),
  ADD COLUMN confirmation_expires_at TIMESTAMPTZ(3);

-- Las solicitudes anteriores no tenían este paso: se consideran confirmadas para no bloquear la agenda.
UPDATE appointments SET contact_email_confirmed_at = created_at;

CREATE UNIQUE INDEX appointments_confirmation_token_unique ON appointments (confirmation_token_hash)
WHERE confirmation_token_hash IS NOT NULL;

-- Barrido de solicitudes sin confirmar vencidas.
CREATE INDEX appointments_unconfirmed_expiry_idx ON appointments (confirmation_expires_at)
WHERE status = 'pending' AND contact_email_confirmed_at IS NULL;
