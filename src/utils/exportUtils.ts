import { createProjectBackup } from './projectData';
import { ProjectData, TargetEngine, WikiPage } from '../types';
import { markdownExportFiles } from './exportPages';

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give mobile browsers time to begin the download before retiring its URL.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export function downloadJsonFile(filename: string, data: unknown) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  triggerBrowserDownload(blob, filename);
}

export function downloadMarkdownFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerBrowserDownload(blob, filename);
}

export async function exportFullProjectZip(
  projectName: string,
  pages: WikiPage[],
  notepad: string,
  targetEngine: TargetEngine,
  project: ProjectData
) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const safeProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Game_Project';

  // 1. Root README
  const rootReadme = `# ${projectName} - Game Design Wiki & Engine Specs
Generated via GameForge Studio. Starter code is example scaffolding with placeholder
values; it is not generated from your wiki and needs engine-specific review.

## Target Engine
- **Engine**: ${targetEngine.name}
- **Language**: ${targetEngine.lang}
- **File Extension**: ${targetEngine.extension}

## Structure
- \`/docs\` - Complete Game Design Document (GDD) pages in standard Markdown.
- \`/notes\` - Private scratchpad notes and brainstorming.
- \`/starter_code\` - Engine-compatible starter boilerplate.
- \`project_manifest.json\` - Full state backup for 1-click restore into GameForge Studio.

## Compatibility
These markdown files follow standard GitHub Flavored Markdown (GFM) and can be opened in:
- Obsidian (drag the \`/docs\` folder into any vault)
- VS Code (Markdown Preview Enhanced)
- GitHub / GitLab Wiki repository
- Notion (Import Markdown & CSV)
- Godot Engine 4 (under \`res://docs/\`)
`;

  zip.file('README.md', rootReadme);

  // 2. GDD Wiki Pages folder
  const docsFolder = zip.folder('docs');
  if (docsFolder) {
    for (const file of markdownExportFiles(pages)) docsFolder.file(file.name, file.content);
  }

  // 3. Scratchpad / Notes folder
  const notesFolder = zip.folder('notes');
  if (notesFolder) {
    notesFolder.file(
      'private_notepad.md',
      `# Private Scratchpad Notes\n\n${notepad || '_No notes recorded._'}\n`
    );
  }

  // 4. Starter Code folder based on engine
  const starterFolder = zip.folder('starter_code');
  if (starterFolder) {
    if (targetEngine.id === 'godot4') {
      starterFolder.file(
        'PlayerController.gd',
        `class_name PlayerController
extends CharacterBody2D

# Example scaffold: replace placeholder mechanics with your wiki specifications.
@export_group("Resonance Stamina")
@export var max_stamina: float = 100.0
@export var stamina_regen_rate: float = 45.0
@export var sprint_cost: float = 18.0
@export var dodge_cost: float = 22.0

@export_group("Kinematics")
@export var walk_speed: float = 240.0
@export var sprint_multiplier: float = 1.6
@export var acceleration: float = 1800.0
@export var friction: float = 2400.0

signal stamina_changed(current: float, max_val: float)
signal overheat_triggered

var current_stamina: float = 100.0
var is_overheated: bool = false

func _physics_process(delta: float) -> void:
    var input_dir: Vector2 = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
    var target_speed: float = walk_speed
    
    if Input.is_action_pressed("sprint") and not is_overheated and input_dir != Vector2.ZERO:
        target_speed *= sprint_multiplier
        current_stamina = max(0.0, current_stamina - sprint_cost * delta)
        stamina_changed.emit(current_stamina, max_stamina)
        if current_stamina <= 0.0:
            trigger_overheat()
    elif not is_overheated and current_stamina < max_stamina:
        current_stamina = min(max_stamina, current_stamina + stamina_regen_rate * delta)
        stamina_changed.emit(current_stamina, max_stamina)

    if input_dir != Vector2.ZERO:
        velocity = velocity.move_toward(input_dir * target_speed, acceleration * delta)
    else:
        velocity = velocity.move_toward(Vector2.ZERO, friction * delta)
        
    move_and_slide()

func trigger_overheat() -> void:
    is_overheated = true
    overheat_triggered.emit()
`
      );
    } else if (targetEngine.id === 'unity') {
      starterFolder.file(
        'PlayerController.cs',
        `using System;
using UnityEngine;

// Example scaffold: replace placeholder mechanics with your wiki specifications.
public class PlayerController : MonoBehaviour
{
    [Header("Resonance Stamina")]
    [SerializeField] private float maxStamina = 100f;
    [SerializeField] private float staminaRegenRate = 45f;
    [SerializeField] private float sprintCost = 18f;
    
    [Header("Kinematics")]
    [SerializeField] private float walkSpeed = 6f;
    [SerializeField] private float sprintMultiplier = 1.6f;
    [SerializeField] private Rigidbody rb;

    public event Action<float, float> OnStaminaChanged;
    public event Action OnOverheatTriggered;

    private float currentStamina;
    private bool isOverheated;

    private void Awake()
    {
        currentStamina = maxStamina;
        if (!rb) rb = GetComponent<Rigidbody>();
    }

    private void FixedUpdate()
    {
        float h = Input.GetAxisRaw("Horizontal");
        float v = Input.GetAxisRaw("Vertical");
        Vector3 moveInput = new Vector3(h, 0f, v).normalized;

        float targetSpeed = walkSpeed;
        bool isSprinting = Input.GetKey(KeyCode.LeftShift) && moveInput.magnitude > 0.01f && !isOverheated;

        if (isSprinting)
        {
            targetSpeed *= sprintMultiplier;
            currentStamina = Mathf.Max(0f, currentStamina - sprintCost * Time.fixedDeltaTime);
            OnStaminaChanged?.Invoke(currentStamina, maxStamina);
            if (currentStamina <= 0f)
            {
                isOverheated = true;
                OnOverheatTriggered?.Invoke();
            }
        }
        else if (!isOverheated && currentStamina < maxStamina)
        {
            currentStamina = Mathf.Min(maxStamina, currentStamina + staminaRegenRate * Time.fixedDeltaTime);
            OnStaminaChanged?.Invoke(currentStamina, maxStamina);
        }

        rb.velocity = new Vector3(moveInput.x * targetSpeed, rb.velocity.y, moveInput.z * targetSpeed);
    }
}
`
      );
    } else {
      starterFolder.file(
        'README.md',
        `# ${targetEngine.name} scaffold\n\nA compiled starter script is not included for this engine. Use the Code Teacher with your wiki to create one.\n`
      );
    }
  }

  // 5. Full Project State Manifest JSON (for 1-click restore)
  const manifest = createProjectBackup(project);
  zip.file('project_manifest.json', JSON.stringify(manifest, null, 2));

  // Generate Zip
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerBrowserDownload(zipBlob, `${safeProjectName}_GDD_Bundle.zip`);
}

