import type { ModelAsset } from '@/types/photobooth'

export const MODEL_REGISTRY: ModelAsset[] = [
  {
    id: "cowboy-hat-1",
    name: "Cowboy Hat",
    path: "cowboy-hat-1.glb",
    type: "hat",
    scale: 0.65,
    positionOffset: { x: 0, y: 0.1, z: -0.2 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    anchorIndex: 10 // top of forehead
  },
  {
    id: "cowboy-hat-free",
    name: "Cowboy Hat (Free)",
    path: "cowboy-hat-free.glb",
    type: "hat",
    scale: 0.13,
    positionOffset: { x: 0, y: 0.2, z: -0.25 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    anchorIndex: 10
  },
  {
    id: "cowboy-hat-lowpoly",
    name: "Low Poly Cowboy Hat",
    path: "cowboy-hat-lowpoly.glb",
    type: "hat",
    scale: 6.5,
    positionOffset: { x: 0, y: 0.1, z: -0.2 },
    rotationOffset: { x: 0, y: 0, z: 0 },
    anchorIndex: 10
  }
]

export function getModelById(id: string): ModelAsset | undefined {
  return MODEL_REGISTRY.find((m) => m.id === id)
}
