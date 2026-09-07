-- InfoServ2A : modele PostgreSQL conceptuel, version documentaire 1.0.
-- Aucune migration n'a ete executee. Adapter types, migrations, index et roles.
-- Les identifiants UUID sont generes par le service, sans extension obligatoire.
-- Les FK composites evitent de rattacher certains objets a un autre workspace.
-- Elles ne suffisent pas a autoriser les lectures ni a isoler deux clients
-- d'un meme workspace : ajouter les politiques RLS et les controles applicatifs.
-- Ne pas utiliser un role proprietaire/superutilisateur pour le service public.
-- Ne pas exposer ces tables au navigateur sans couche d'autorisation.

CREATE TABLE workspaces (
    workspace_id text PRIMARY KEY,
    display_name text NOT NULL,
    business_timezone text NOT NULL,
    currency char(3) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE actors (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    actor_id text NOT NULL,
    identity_provider text NOT NULL,
    provider_subject text NOT NULL,
    actor_kind text NOT NULL CHECK (actor_kind IN ('human', 'service')),
    disabled_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, actor_id),
    UNIQUE (workspace_id, identity_provider, provider_subject)
);

CREATE TABLE customers (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    customer_id text NOT NULL,
    display_name text NOT NULL,
    authoritative_provider text,
    authoritative_id text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, customer_id),
    UNIQUE (workspace_id, authoritative_provider, authoritative_id)
);

CREATE TABLE projects (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    project_id text NOT NULL,
    customer_id text,
    name text NOT NULL,
    status text NOT NULL,
    reference_document text,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, project_id),
    UNIQUE (workspace_id, project_id, customer_id),
    FOREIGN KEY (workspace_id, customer_id)
        REFERENCES customers(workspace_id, customer_id)
);

CREATE TABLE policy_grants (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    grant_id text NOT NULL,
    subject_actor_id text NOT NULL,
    issued_by_actor_id text NOT NULL,
    instruction_reference text NOT NULL,
    capability_ids jsonb NOT NULL CHECK (jsonb_typeof(capability_ids) = 'array'),
    scope_constraints jsonb NOT NULL CHECK (jsonb_typeof(scope_constraints) = 'object'),
    limits jsonb NOT NULL CHECK (jsonb_typeof(limits) = 'object'),
    valid_from timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    version integer NOT NULL CHECK (version > 0),
    PRIMARY KEY (workspace_id, grant_id),
    FOREIGN KEY (workspace_id, subject_actor_id)
        REFERENCES actors(workspace_id, actor_id),
    FOREIGN KEY (workspace_id, issued_by_actor_id)
        REFERENCES actors(workspace_id, actor_id),
    CHECK (expires_at IS NULL OR expires_at > valid_from)
);

CREATE TABLE missions (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    mission_id uuid NOT NULL,
    actor_id text NOT NULL,
    customer_id text,
    project_id text,
    grant_id text,
    schema_version text NOT NULL,
    correlation_id uuid NOT NULL,
    idempotency_key text NOT NULL,
    request_sha256 char(64) NOT NULL,
    origin text NOT NULL CHECK (origin IN ('cursor', 'codex', 'claire', 'schedule', 'webhook', 'operator')),
    capability_id text NOT NULL,
    capability_version text NOT NULL,
    objective text NOT NULL,
    arguments jsonb NOT NULL CHECK (jsonb_typeof(arguments) = 'object'),
    status text NOT NULL CHECK (status IN (
        'draft', 'ready', 'running', 'waiting_access', 'waiting_input',
        'waiting_decision', 'reconciling', 'completed', 'failed',
        'cancel_requested', 'cancelled'
    )),
    budget_currency char(3) NOT NULL,
    max_cost_minor bigint NOT NULL CHECK (max_cost_minor >= 0),
    max_duration_seconds integer NOT NULL CHECK (max_duration_seconds > 0),
    result jsonb,
    error jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz,
    revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
    PRIMARY KEY (workspace_id, mission_id),
    UNIQUE (workspace_id, actor_id, capability_id, idempotency_key),
    FOREIGN KEY (workspace_id, actor_id)
        REFERENCES actors(workspace_id, actor_id),
    FOREIGN KEY (workspace_id, customer_id)
        REFERENCES customers(workspace_id, customer_id),
    FOREIGN KEY (workspace_id, project_id)
        REFERENCES projects(workspace_id, project_id),
    FOREIGN KEY (workspace_id, project_id, customer_id)
        REFERENCES projects(workspace_id, project_id, customer_id),
    FOREIGN KEY (workspace_id, grant_id)
        REFERENCES policy_grants(workspace_id, grant_id),
    CHECK (status <> 'completed' OR (result IS NOT NULL AND error IS NULL)),
    CHECK (status <> 'failed' OR error IS NOT NULL)
);

CREATE TABLE jobs (
    workspace_id text NOT NULL,
    job_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    step_key text NOT NULL,
    executor_id text,
    target_reference text,
    status text NOT NULL CHECK (status IN (
        'queued', 'leased', 'running', 'reconciling', 'succeeded',
        'failed', 'cancel_requested', 'cancelled'
    )),
    attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    available_at timestamptz NOT NULL DEFAULT now(),
    lease_owner text,
    lease_expires_at timestamptz,
    input jsonb NOT NULL,
    output jsonb,
    external_operation_key text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, job_id),
    UNIQUE (workspace_id, mission_id, step_key),
    FOREIGN KEY (workspace_id, mission_id)
        REFERENCES missions(workspace_id, mission_id)
);

CREATE TABLE mission_events (
    workspace_id text NOT NULL,
    event_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    sequence_number bigint NOT NULL CHECK (sequence_number > 0),
    event_type text NOT NULL,
    schema_version text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, event_id),
    UNIQUE (workspace_id, mission_id, sequence_number),
    FOREIGN KEY (workspace_id, mission_id)
        REFERENCES missions(workspace_id, mission_id)
);

CREATE TABLE evidence (
    workspace_id text NOT NULL,
    evidence_id text NOT NULL,
    mission_id uuid NOT NULL,
    kind text NOT NULL CHECK (kind IN (
        'source', 'provider_readback', 'artifact', 'test_result', 'operator_observation'
    )),
    reference text NOT NULL,
    sha256 char(64),
    provider text,
    external_id text,
    captured_at timestamptz NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (workspace_id, evidence_id),
    FOREIGN KEY (workspace_id, mission_id)
        REFERENCES missions(workspace_id, mission_id)
);

CREATE TABLE sources (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    source_id text NOT NULL,
    customer_id text,
    project_id text,
    locator text NOT NULL,
    source_version text NOT NULL,
    sha256 char(64),
    authority text NOT NULL,
    classification text NOT NULL CHECK (classification IN ('public', 'internal', 'client_restricted', 'restricted')),
    acl_reference text NOT NULL,
    source_modified_at timestamptz,
    indexed_at timestamptz,
    deleted_at timestamptz,
    retention_until timestamptz,
    extraction_status text NOT NULL CHECK (extraction_status IN ('pending', 'indexed', 'failed', 'excluded', 'deleted')),
    PRIMARY KEY (workspace_id, source_id),
    UNIQUE (workspace_id, locator),
    FOREIGN KEY (workspace_id, customer_id)
        REFERENCES customers(workspace_id, customer_id),
    FOREIGN KEY (workspace_id, project_id)
        REFERENCES projects(workspace_id, project_id)
);

CREATE TABLE external_objects (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    provider text NOT NULL,
    external_id text NOT NULL,
    object_type text NOT NULL,
    mission_id uuid,
    customer_id text,
    business_state text NOT NULL,
    provider_version text,
    last_read_at timestamptz NOT NULL,
    private_reference text,
    PRIMARY KEY (workspace_id, provider, object_type, external_id),
    FOREIGN KEY (workspace_id, mission_id)
        REFERENCES missions(workspace_id, mission_id),
    FOREIGN KEY (workspace_id, customer_id)
        REFERENCES customers(workspace_id, customer_id)
);

CREATE TABLE outbox_events (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    outbox_id uuid NOT NULL,
    event_id uuid NOT NULL,
    destination text NOT NULL,
    available_at timestamptz NOT NULL DEFAULT now(),
    delivered_at timestamptz,
    delivery_attempts integer NOT NULL DEFAULT 0 CHECK (delivery_attempts >= 0),
    PRIMARY KEY (workspace_id, outbox_id),
    UNIQUE (workspace_id, event_id, destination),
    FOREIGN KEY (workspace_id, event_id)
        REFERENCES mission_events(workspace_id, event_id)
);

CREATE TABLE webhook_inbox (
    workspace_id text NOT NULL REFERENCES workspaces(workspace_id),
    provider text NOT NULL,
    provider_event_id text NOT NULL,
    signature_verified boolean NOT NULL CHECK (signature_verified),
    received_at timestamptz NOT NULL DEFAULT now(),
    payload_sha256 char(64) NOT NULL,
    payload_reference text NOT NULL,
    processed_at timestamptz,
    PRIMARY KEY (workspace_id, provider, provider_event_id)
);

CREATE TABLE cost_entries (
    workspace_id text NOT NULL,
    cost_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    provider text NOT NULL,
    usage_kind text NOT NULL,
    quantity numeric(20, 6) NOT NULL CHECK (quantity >= 0),
    unit text NOT NULL,
    amount_minor numeric(20, 6) NOT NULL CHECK (amount_minor >= 0),
    currency char(3) NOT NULL,
    measurement_status text NOT NULL CHECK (measurement_status IN ('estimated', 'observed', 'invoiced')),
    measured_at timestamptz NOT NULL,
    source_reference text NOT NULL,
    PRIMARY KEY (workspace_id, cost_id),
    FOREIGN KEY (workspace_id, mission_id)
        REFERENCES missions(workspace_id, mission_id)
);

CREATE INDEX missions_status_updated_idx
    ON missions(workspace_id, status, updated_at);
CREATE INDEX jobs_claim_idx
    ON jobs(workspace_id, status, available_at, lease_expires_at);
CREATE INDEX sources_project_idx
    ON sources(workspace_id, project_id, extraction_status);
CREATE INDEX evidence_mission_idx
    ON evidence(workspace_id, mission_id);
CREATE INDEX outbox_pending_idx
    ON outbox_events(available_at) WHERE delivered_at IS NULL;

-- Regles a implementer et recetter avant activation :
-- 1. Autorisation serveur et RLS selon acteur, workspace, client et projet.
-- 2. Transitions d'etat atomiques avec controle de revision et preuve finale.
-- 3. Refuser une meme cle d'idempotence associee a un autre request_sha256.
-- 4. Transaction pour enregistrer mutation interne, evenement et outbox.
-- 5. Prise de lease atomique et rapprochement avant repetition externe.
-- 6. Mise a jour de updated_at, et invariants client/projet meme avec NULL.
-- 7. Secrets dans un coffre ; conservation et purge des donnees personnelles.
-- 8. Politique d'immuabilite logique des preuves et journal d'acces.
-- 9. Les fractions d'unite minimale de cost_entries servent aux couts IA fins.
--    Arrondir explicitement pour un total presente ; les factures restent en
--    entiers d'unite minimale dans les contrats metier et chez leur fournisseur.
-- 10. Ce modele n'est pas le schema interne de Hermes et ne le remplace pas.
