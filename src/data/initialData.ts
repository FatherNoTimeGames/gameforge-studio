import { TargetEngine, WikiPage } from '../types';

export const TARGET_ENGINES: TargetEngine[] = [
  {
    id: 'godot4',
    name: 'Godot 4.x (GDScript)',
    lang: 'GDScript 2.0',
    extension: '.gd',
    category: '2D/3D Engine',
    icon: 'Bot',
    description: 'Modern typed GDScript with @export, signals, CharacterBody2D/3D, and Node tree architecture.',
    syntaxHighlights: '@export var speed: float = 300.0\nsignal on_stamina_depleted\nfunc _physics_process(delta: float) -> void:'
  },
  {
    id: 'unity',
    name: 'Unity (C#)',
    lang: 'C# .NET',
    extension: '.cs',
    category: '2D/3D Engine',
    icon: 'Boxes',
    description: 'Modern Unity C# MonoBehaviours, ScriptableObjects, [SerializeField], and Unity Events.',
    syntaxHighlights: '[SerializeField] private float speed = 10f;\npublic event Action OnStaminaDepleted;\nprivate void FixedUpdate() {'
  },
  {
    id: 'godot3',
    name: 'Godot 3.5 (GDScript legacy)',
    lang: 'GDScript 1.0',
    extension: '.gd',
    category: '2D/3D Engine',
    icon: 'Layers',
    description: 'Legacy Godot 3 syntax using KinematicBody2D, export(float), and yield().',
    syntaxHighlights: 'export(float) var speed = 250.0\nsignal health_changed(new_val)\nfunc _physics_process(delta):'
  },
  {
    id: 'unreal',
    name: 'Unreal Engine 5 (C++)',
    lang: 'C++ / UObject',
    extension: '.cpp',
    category: '3D AAA',
    icon: 'Shield',
    description: 'UE5 Gameplay Framework with UPROPERTY, delegates, TickComponent, and CharacterMovement.',
    syntaxHighlights: 'UPROPERTY(EditAnywhere, BlueprintReadWrite, Category="Stats")\nfloat StaminaCurrent;\nvirtual void Tick(float DeltaTime) override;'
  },
  {
    id: 'phaser',
    name: 'Phaser 3 (TypeScript)',
    lang: 'TypeScript',
    extension: '.ts',
    category: 'Web',
    icon: 'Globe',
    description: 'Browser HTML5/WebGL game engine with Arcade Physics, Scenes, and Events.',
    syntaxHighlights: 'public update(time: number, delta: number): void {\n  this.player.setVelocityX(this.speed);\n}'
  },
  {
    id: 'pygame',
    name: 'Pygame 2 (Python)',
    lang: 'Python 3',
    extension: '.py',
    category: 'Framework',
    icon: 'Terminal',
    description: 'Classic Python 2D game library with pygame.sprite.Sprite, dt delta time, and rect collisions.',
    syntaxHighlights: 'class Player(pygame.sprite.Sprite):\n    def update(self, dt: float):\n        self.rect.x += self.vx * dt'
  },
  {
    id: 'bevy',
    name: 'Bevy Engine (Rust)',
    lang: 'Rust',
    extension: '.rs',
    category: 'Framework',
    icon: 'Cpu',
    description: 'Data-driven ECS framework in Rust with systems, queries, and components.',
    syntaxHighlights: '#[derive(Component)]\nstruct Stamina { current: f32, max: f32 }\nfn stamina_regen_system(time: Res<Time>, mut q: Query<&mut Stamina>) {'
  }
];

export const INITIAL_WIKI_PAGES: WikiPage[] = [
  {
    id: 'page-home',
    title: 'Game Overview & Pillars',
    category: 'Core',
    tags: ['Overview', 'Design Pillars', 'Genre'],
    lastModified: Date.now() - 3600000,
    content: `# Project ChronoStrike: Game Design Document

## 1. High Concept
A fast-paced sci-fi roguelite action game where the player can briefly phase through attacks, but all mobility and special strikes draw from a singular, fast-recharging [[Resonance Battery (Stamina)|Stats & Attributes]].

## 2. Core Pillars
1. **Readable Momentum**: Movement is snappy, physics-grounded, with zero floatiness. Every dodge must feel deliberate.
2. **Resource Tension**: The Resonance gauge recharges in 1.8s when stationary, but stops regenerating while sprinting or channeling shields.
3. **Engine Portability**: Clean node/component architecture, separating data models from rendering views so logic translates easily between Godot 4, Unity, or custom frameworks.

## 3. Core Systems Directory
- [[Combat & Stamina System]] — Core combat rules, weapon strikes, and poise.
  - Subpage: [[Damage & Hitstop Formulas]] — Mathematical calculation for poise damage.
  - Subpage: [[Overheat & Burnout Recovery]] — What happens when battery hits 0.0.
- [[Player Controller & Physics]] — Kinematics and input buffer.
  - Subpage: [[Phase Dodge Kinematics]] — Invulnerability frames and collision layer masks.
- [[Stats & Attributes]] — Core character progression and scaling.
  - Subpage: [[Strength & Poise]] — How the [[Strength|Strength & Poise]] attribute increases stagger damage.
- [[Enemy AI & State Machine]] — Token-based mob engagement logic.
`
  },
  {
    id: 'page-combat',
    title: 'Combat & Stamina System',
    category: 'Mechanics',
    tags: ['Combat', 'Stamina', 'Balancing'],
    lastModified: Date.now() - 1800000,
    content: `# Combat & Stamina System

## 1. Resonance (Stamina) Parameter Model
| Attribute | Base Value | Upgrade Cap | Scaling System |
| :--- | :--- | :--- | :--- |
| **Max Stamina** | 100.0 | 250.0 | Scales with [[Core Relics|Stats & Attributes]] |
| **Regen Rate** | 45.0 / sec | 90.0 / sec | Recharging begins after 0.4s idle delay |
| **Sprint Cost** | 18.0 / sec | 10.0 / sec | Prevents infinite running |
| **Phase Dodge** | 22.0 flat | 14.0 flat | Covered in detail on [[Phase Dodge Kinematics]] |
| **Heavy Strike** | 35.0 flat | 25.0 flat | Scales with player [[Strength|Strength & Poise]] |

## 2. Sub-Mechanics
- Refer to [[Damage & Hitstop Formulas]] for exact freeze-frame milliseconds.
- Refer to [[Overheat & Burnout Recovery]] for penalty durations and audio-visual cues.
`
  },
  {
    id: 'page-combat-damage',
    title: 'Damage & Hitstop Formulas',
    parentId: 'page-combat',
    category: 'Mechanics',
    tags: ['Formulas', 'Hitstop', 'Juice'],
    lastModified: Date.now() - 1200000,
    content: `# Damage & Hitstop Formulas (Subpage)

## 1. Hitstop Timing Table
- **Light Blade Slash**: 45ms freeze-frame.
- **Heavy Charged Strike**: 90ms freeze-frame (scales with [[Strength|Strength & Poise]]).
- **Perfect Parry Deflection**: 130ms freeze-frame with camera micro-zoom (1.04x).

## 2. Poise Damage Formula
\`\`\`text
Final_Poise_Dmg = Base_Weapon_Poise * (1.0 + (Player_Strength * 0.025))
\`\`\`
Triggers an immediate stagger if target poise drops below 0.0.
`
  },
  {
    id: 'page-combat-overheat',
    title: 'Overheat & Burnout Recovery',
    parentId: 'page-combat',
    category: 'Mechanics',
    tags: ['Penalty', 'Overheat', 'Burnout'],
    lastModified: Date.now() - 1100000,
    content: `# Overheat & Burnout Recovery (Subpage)

## 1. Penalty Parameters
- Trigger: Resonance drops to \`0.0\`.
- **Sluggish State**: Movement speed cut by **30%** for 1.2s.
- **Lockout**: [[Phase Dodge|Phase Dodge Kinematics]] is disabled during Overheat.
- **Audio Cue**: Low-frequency warning buzzer (220 Hz pitch drop).

## 2. Emergency Cleanse
Executing a frame-perfect parry with the primary blade during Overheat instantly restores 40.0 Resonance and removes the sluggish state.
`
  },
  {
    id: 'page-player',
    title: 'Player Controller & Physics',
    category: 'Systems',
    tags: ['Physics', 'Movement', 'Input'],
    lastModified: Date.now() - 900000,
    content: `# Player Controller & Physics

## 1. Kinematic Constants
- **Base Walk Speed**: 240.0 px/sec (Godot 2D) / 6.0 m/s (Unity 3D)
- **Sprint Multiplier**: 1.6x (384 px/sec) — consumes stamina via [[Combat & Stamina System]]
- **Acceleration**: 1800.0 px/sec² (instant feel, 0.13s to top speed)
- **Friction / Deceleration**: 2400.0 px/sec² (crisp stop on releasing analog stick)

## 2. Sub-Modules
- For dodge distance and collision masks, see subpage: [[Phase Dodge Kinematics]].
`
  },
  {
    id: 'page-player-dodge',
    title: 'Phase Dodge Kinematics',
    parentId: 'page-player',
    category: 'Systems',
    tags: ['Dodge', 'Kinematics', 'Collision'],
    lastModified: Date.now() - 800000,
    content: `# Phase Dodge Kinematics (Subpage)

## 1. Vector Profile
- **Dash Distance**: 180 units covered across 0.28 seconds.
- **Invulnerability**: Grants 220ms i-frames.
- **Speed Curve**: Quadratic ease-out (\`1 - (1 - t)^2\`).
- **Collision Mask Shift**: Player shifts from Layer 1 (Solid) to Layer 4 (Ethereal) to phase through grunt mobs.
`
  },
  {
    id: 'page-stats',
    title: 'Stats & Attributes',
    category: 'Systems',
    tags: ['Stats', 'RPG', 'Scaling'],
    lastModified: Date.now() - 700000,
    content: `# Stats & Attributes

## 1. Core Primary Attributes
1. **[[Strength|Strength & Poise]]**: Increases physical stagger damage and heavy strike impact.
2. **Resonance Capacity**: Raises maximum battery from 100.0 up to 250.0.
3. **Agility**: Lowers Phase Dodge stamina cost and increases sprint top speed.
`
  },
  {
    id: 'page-stats-strength',
    title: 'Strength & Poise',
    parentId: 'page-stats',
    category: 'Systems',
    tags: ['Strength', 'Poise', 'Attribute'],
    lastModified: Date.now() - 600000,
    content: `# Strength & Poise (Subpage)

## 1. Scaling Formulas
Every point of **Strength** grants:
- **+2.5%** stagger poise damage to [[Heavy Strikes|Combat & Stamina System]].
- **+1.0%** damage reduction against projectile hits.
- Weapon wield requirements for Greatblades and Kinetic Hammers.
`
  },
  {
    id: 'page-ai',
    title: 'Enemy AI & State Machine',
    category: 'Systems',
    tags: ['AI', 'FSM', 'Behaviors'],
    lastModified: Date.now() - 400000,
    content: `# Enemy AI & State Machine

## 1. Finite State Machine (FSM)
1. **PATROL**: Loops waypoints; vision cone check (angle 75°, distance 350px).
2. **ALERT**: Player spotted in periphery; stops 0.4s to enter combat stance.
3. **ENGAGE**: Closes distance to weapon range (80px for melee, 260px for ranged).
4. **ATTACK_TELEGRAPH**: Red warning indicator flashes for 0.35s (parry window).
5. **STAGGER**: Triggered when poise is depleted by player [[Strength attacks|Strength & Poise]].

## 2. Coordination Token Pool
To prevent player swarming, only **2 melee enemies** may possess the "Attack Token" simultaneously.
`
  }
];

export const COMPATIBILITY_GUIDES = [
  {
    feature: 'Signals & Event Systems',
    godot4: 'signal stamina_changed(val: float)\nemit_signal("stamina_changed", 100.0)\n# Or typed: stamina_changed.emit(100.0)',
    unity: 'public event Action<float> OnStaminaChanged;\nOnStaminaChanged?.Invoke(100f);',
    unreal: 'DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnStaminaChanged, float, NewVal);\nOnStaminaChanged.Broadcast(100.f);',
    pygame: 'pygame.event.post(pygame.event.Event(CUSTOM_EVENT, {"stamina": 100.0}))',
    obsidian: 'GDD Wiki exports as 100% standard GFM Markdown (.md). Fully readable in Obsidian, Notion, GitHub Docs, VS Code, and VitePress.'
  },
  {
    feature: 'Frame Delta & Movement',
    godot4: 'func _physics_process(delta: float):\n  velocity = input_dir * speed\n  move_and_slide()',
    unity: 'void FixedUpdate() {\n  rb.velocity = inputDir * speed;\n}',
    unreal: 'void ATick(float DeltaTime) {\n  AddMovementInput(InputDir, Speed * DeltaTime);\n}',
    pygame: 'def update(self, dt):\n  self.rect.x += self.vx * dt',
    obsidian: 'Mathematical formulas (e.g. friction, quadratic dodge curves) format cleanly with markdown tables and code blocks.'
  },
  {
    feature: 'Data & Scriptable Items',
    godot4: 'class_name ItemData extends Resource\n@export var id: String\n@export var cost: int',
    unity: '[CreateAssetMenu]\npublic class ItemData : ScriptableObject {\n  public string id;\n  public int cost;\n}',
    unreal: 'UCLASS(BlueprintType)\nclass UItemData : public UPrimaryDataAsset {\n  GENERATED_BODY()\n  UPROPERTY() FString Id;\n};',
    pygame: '@dataclass\nclass ItemData:\n  id: str\n  cost: int',
    obsidian: 'Data tables in the wiki export to JSON or CSV for direct engine import.'
  }
];
