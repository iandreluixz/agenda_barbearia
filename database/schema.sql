CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS professionals (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS appointments (
    id SERIAL PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    professional_id INTEGER NOT NULL REFERENCES professionals(id),
    service_id INTEGER NOT NULL REFERENCES services(id),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (status IN ('confirmed', 'cancelled')),
    reminder_sent_at TIMESTAMPTZ,
    reminder_claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (ends_at > starts_at),
    CONSTRAINT appointments_no_overlap
        EXCLUDE USING gist (
            professional_id WITH =,
            tstzrange(starts_at, ends_at, '[)') WITH &&
        )
        WHERE (status = 'confirmed')
);

CREATE INDEX IF NOT EXISTS appointments_starts_at_idx
    ON appointments (starts_at)
    WHERE status = 'confirmed';

INSERT INTO professionals (name)
SELECT 'Rafael'
WHERE NOT EXISTS (SELECT 1 FROM professionals);

INSERT INTO professionals (name)
SELECT 'Marcos'
WHERE NOT EXISTS (SELECT 1 FROM professionals WHERE name = 'Marcos');

INSERT INTO services (name, duration_minutes, price_cents)
SELECT seed.name, seed.duration_minutes, seed.price_cents
FROM (VALUES
    ('Corte', 30, 4000),
    ('Barba', 30, 3000),
    ('Corte + barba', 60, 6500)
) AS seed(name, duration_minutes, price_cents)
WHERE NOT EXISTS (
    SELECT 1 FROM services existing WHERE existing.name = seed.name
);
