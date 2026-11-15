# Modelo de dados (DER)

As tabelas do PostgreSQL do Nupii, escritas a partir do sistema pronto ([roteiro](roteiro.md), fatia 11). O diagrama foi gerado do esquema de um banco com todas as migrations de `backend/db/migrations` aplicadas (versão 16, `00016_share_link_exams.sql`). Ele tem as 14 tabelas e as 14 chaves estrangeiras das migrations. Os conceitos estão no [diagrama de domínio](dominio.md).

Ficam fora do diagrama `goose_db_version` (o controle das migrations) e `spatial_ref_sys` (a tabela da extensão PostGIS). O schema `metrics` (migration 00017) só tem views de contagem para o Grafana, sem tabelas próprias ([ADR 0032](adr/0032-observabilidade-lgtm.md), item 9).

```mermaid
erDiagram
  devices {
    text token PK
    uuid owner_id FK
    text platform
    boolean active
    timestamptz updated_at
  }
  health_attachments {
    uuid id PK
    uuid event_id FK
    text key
    text content_type
    text file_name
    integer size_bytes
    timestamptz created_at
  }
  health_events {
    uuid id PK
    uuid pet_id FK
    text type
    date date
    text notes "nulo"
    text name "nulo"
    text vet "nulo"
    text manufacturer "nulo"
    text batch "nulo"
    text dose "nulo"
    date next_dose_date "nulo"
    text clinic "nulo"
    text reason "nulo"
    text diagnosis "nulo"
    numeric weight_kg "nulo"
    date return_date "nulo"
    text medication_category "nulo"
    text active_ingredient "nulo"
    text dosage "nulo"
    text frequency "nulo"
    date end_date "nulo"
    boolean in_use "nulo"
    integer interval_days "nulo"
    text lab "nulo"
    text result "nulo"
    text note_category "nulo"
    text title "nulo"
    boolean remind
    timestamptz created_at
    timestamptz updated_at
  }
  identification_candidates {
    uuid id PK
    uuid identification_id FK
    uuid noseprint_id FK
    uuid pet_id FK
    smallint rank
    float8 similarity
    timestamptz confirmed_at "nulo"
  }
  identifications {
    uuid id PK
    text model_version
    geography location "nulo"
    text photo_key "nulo"
    text contact_name "nulo"
    text contact_phone "nulo"
    text contact_message "nulo"
    timestamptz created_at
  }
  jobs {
    uuid id PK
    text kind
    jsonb payload
    text status
    integer attempts
    timestamptz run_at
    text last_error "nulo"
    timestamptz created_at
    timestamptz updated_at
  }
  noseprints {
    uuid id PK
    uuid pet_id FK
    text image_key
    vector512 embedding
    text model_version
    float8 quality
    boolean is_primary
    timestamptz captured_at
  }
  notifications {
    uuid id PK
    uuid owner_id FK
    text kind
    uuid source_id
    uuid report_id "nulo"
    text title
    text body
    integer distance_m "nulo"
    text push_status
    timestamptz created_at
    timestamptz read_at "nulo"
  }
  owner_locations {
    uuid owner_id PK,FK
    geography location
    timestamptz updated_at
  }
  owners {
    uuid id PK
    text firebase_uid
    text email
    text name
    text terms_version
    timestamptz terms_accepted_at
    timestamptz created_at
    timestamptz deleted_at "nulo"
  }
  pets {
    uuid id PK
    uuid owner_id FK
    text name
    text species
    text breed "nulo"
    text sex "nulo"
    text size "nulo"
    date birth_date "nulo"
    numeric weight_kg "nulo"
    boolean neutered "nulo"
    text vet_name "nulo"
    text vet_clinic "nulo"
    text vet_phone "nulo"
    timestamptz created_at
    timestamptz updated_at
    timestamptz deleted_at "nulo"
    text photo_key "nulo"
  }
  reports {
    uuid id PK
    text type
    text status
    uuid owner_id FK "nulo"
    uuid pet_id FK "nulo"
    text photo_key "nulo"
    bytea resolve_code_hash "nulo"
    float8 latitude
    float8 longitude
    text place "nulo"
    text description "nulo"
    timestamptz occurred_at
    timestamptz created_at
    timestamptz resolved_at "nulo"
  }
  share_links {
    uuid id PK
    uuid pet_id FK
    bytea token_hash
    timestamptz expires_at
    integer opens
    timestamptz revoked_at "nulo"
    timestamptz created_at
    boolean include_exams
  }
  sightings {
    uuid id PK
    uuid report_id FK
    float8 latitude
    float8 longitude
    text place "nulo"
    text description "nulo"
    timestamptz created_at
  }
  owners ||--o{ devices : "owner_id"
  health_events ||--o{ health_attachments : "event_id"
  pets ||--o{ health_events : "pet_id"
  identifications ||--o{ identification_candidates : "identification_id"
  noseprints ||--o{ identification_candidates : "noseprint_id"
  pets ||--o{ identification_candidates : "pet_id"
  pets ||--o{ noseprints : "pet_id"
  owners ||--o{ notifications : "owner_id"
  owners ||--o| owner_locations : "owner_id"
  owners ||--o{ pets : "owner_id"
  owners |o--o{ reports : "owner_id"
  pets |o--o{ reports : "pet_id"
  pets ||--o{ share_links : "pet_id"
  reports ||--o{ sightings : "report_id"
```

Legenda: `PK` chave primária, `FK` chave estrangeira, `"nulo"` coluna que aceita nulo. Os tipos: `geography` é `geography(Point,4326)` do PostGIS, `vector512` é `vector(512)` do pgvector, `numeric` é `numeric(5,2)`.

## Restrições únicas

| Tabela | Colunas | Regra |
|---|---|---|
| `owners` | `firebase_uid` | Um tutor por conta do Firebase. |
| `noseprints` | `pet_id` onde `is_primary` | Um focinho principal por pet (RN-09). |
| `reports` | `pet_id` onde `type = 'lost'` e `status = 'open'` | Um desaparecimento aberto por pet (RN-68). |
| `identification_candidates` | `identification_id`, `rank` | Uma posição por candidato. |
| `notifications` | `owner_id`, `kind`, `source_id` | Uma notificação por evento e por tutor. |
| `share_links` | `token_hash` | O token do link é único; a tabela guarda só o hash. |
| `jobs` | `kind`, `run_at` onde `kind = 'purge_expired_data'` | Uma limpeza diária por horário (RF-32). |

## Exclusões

As chaves estrangeiras não têm `ON DELETE CASCADE` (a ação é `NO ACTION`): as queries apagam as linhas filhas antes da linha mãe, por exemplo `health_attachments` antes de `health_events`. A exclusão da conta não apaga a linha do tutor: ela anonimiza o tutor, grava `deleted_at` e apaga ou anonimiza os dados de cada módulo na mesma transação ([ADR 0028](adr/0028-exclusao-da-conta-e-limpeza.md)). Os arquivos (fotos, anexos) ficam no S3, e as colunas `*_key` guardam o caminho deles.
