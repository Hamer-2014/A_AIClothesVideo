export interface GlobalHardConstraintsInput {
  hasBackAsset: boolean;
  hasDetailAsset: boolean;
  hasSceneAsset: boolean;
}

export function buildGlobalHardConstraints(input: GlobalHardConstraintsInput): string[] {
  const constraints = [
    "Do not invent garment details not visible in the uploaded assets.",
    "Keep garment color, silhouette, visible pattern, and construction consistent with the garment reference images.",
  ];

  if (!input.hasBackAsset) {
    constraints.push("Do not show the back side because no back asset is available.");
    constraints.push("Do not use turn-around, 360 display, or front-to-back transition.");
  }

  if (!input.hasDetailAsset) {
    constraints.push("Do not use macro shots or detail close-up shots because no detail asset is available.");
  }

  if (input.hasSceneAsset) {
    constraints.push("Use scene images only as background, lighting, and mood reference.");
    constraints.push(
      "Do not copy people, faces, logos, storefront names, or readable text from scene images.",
    );
  }

  return constraints;
}

export function formatGlobalHardConstraintsForPrompt(constraints: string[]): string[] {
  return constraints.map((constraint) => constraint.trim()).filter(Boolean);
}

export function assetFactsSnapshotFromAssets(assets: Array<{ role: string }>): {
  hasBack: boolean;
  hasDetail: boolean;
  hasScene: boolean;
} {
  const roles = new Set(assets.map((asset) => asset.role.trim().toLowerCase()));

  return {
    hasBack: roles.has("back"),
    hasDetail: roles.has("detail"),
    hasScene: roles.has("scene"),
  };
}
