# A small ecological model

MICROVERSE uses discrete deterministic cycles. Rendering never calls the engine. `tickWorld` advances one cycle; the application owns timing, pause, speed, and save timestamps. No time accrues while the app is closed.

`createWorld(input, id?, now?)` generates a reproducible state from the normalized initial conditions and an FNV-1a / Mulberry32 seed. Wall-clock timestamps and record identity do not influence ecology. Actions and ticks return new records; saved event snapshots are never modified.

All ecological percentages and Genesis energy range from 0 to 100. Water is surface coverage; vegetation is a stylized coverage index reduced by a lack of land. Temperature is −50 to 80°C, sunlight 20–160% of the reference star, and gravity 0.3–2 Earth g. Cycles are integers capped at one billion. This is a game model, not a scientific prediction.

Sunlight, industrial pollution, forests, and volcanic activity set a slowly approached climate equilibrium. Heat evaporates water. Water and forests regulate humidity. A habitat score combines temperature, water/land availability, sunlight, and gravity; fertility and initial life potential determine plant growth. Vegetation supports animals and biodiversity; life replenishes fertility and resources. Settlements consume resources and produce pollution, eventually requiring conservation. Pollution harms habitats. Ecological stability combines these conditions.

Six interventions spend Genesis energy, which regenerates every cycle even in a lifeless world. Heat regulation also moderates solar input, and ocean restoration moves water toward 64%, so extreme dry, wet, hot, and cold starting worlds can recover. Introducing species raises life potential; forests and conservation rebuild habitats. Settlement prerequisites are enforced before any cost is charged.

Ten state-triggered events apply real deltas and capture the resulting state. Rain, ice, drought, forests, species, biodiversity and crisis have explicit thresholds. Volcanic activity, meteors and coastal settlement additionally roll the serialized seeded RNG. Each is a one-time milestone. At most two milestones appear in one tick. Historical records preserve all milestones plus the newest interventions, capped at 180 entries.

Six discoveries have inspectable conditions in `src/data/ecology.ts`. Ocean and balance streaks advance only on ticks, and interventions can break but never increment them. All discoveries award eight energy once. Crisis recovery has two stages: surviving in a temperate environment, then restoring a rich and stable biosphere.
