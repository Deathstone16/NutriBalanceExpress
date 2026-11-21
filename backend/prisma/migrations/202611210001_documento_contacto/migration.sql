-- DNI informado por quien solicita el turno. Nullable para conservar las solicitudes previas.
ALTER TABLE appointments ADD COLUMN contact_document_number VARCHAR(9);
ALTER TABLE appointments ADD CONSTRAINT appointments_contact_document_check
  CHECK (contact_document_number IS NULL OR contact_document_number ~ '^[0-9]{7,9}$');
