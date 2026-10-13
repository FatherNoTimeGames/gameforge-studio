// Single source of truth for values shared between the Express server,
// serverless functions, and the browser bundle.

export const DEFAULT_MODEL = 'gpt-5-mini';
export const FALLBACK_MODELS = ['gpt-5-mini', 'gpt-5-nano'];

export const AVAILABLE_ENGINES = [
  'GDScript - Godot 4',
  'C# - Unity',
  'GDScript - Godot 3',
  'C++ / Blueprints - Unreal Engine 5',
  'TypeScript - Phaser 3',
  'Python - Pygame 2',
  'Rust - Bevy Engine'
];
