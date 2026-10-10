import { parseEditIntent } from './edit-intent';

export function buildImagePrompt(input: {
  productName: string;
  productFacts: string;
  brief?: Record<string, unknown> | null;
  concept?: Record<string, unknown> | null;
  modelProfile?: Record<string, unknown> | null;
  userInstructions?: string;
  variation?: { preserve?: string[]; changes?: string[] };
  internalConstraints: string;
}): { userVisible: string; providerPrompt: string } {
  const concept = input.concept || {};
  const brief = input.brief || {};
  const model = input.modelProfile || {};
  const userVisible = [
    input.userInstructions?.trim(),
    typeof concept.title === 'string' ? concept.title : '',
  ]
    .filter(Boolean)
    .join(' — ');

  const variation = input.variation;
  const providerPrompt = [
    'Create a photorealistic professional product advertisement still.',
    `Product: ${input.productName}.`,
    `Known product facts (do not invent medical or regulatory claims): ${input.productFacts}`,
    brief.visualStyle ? `Visual style: ${brief.visualStyle}` : '',
    brief.environment ? `Environment: ${brief.environment}` : '',
    brief.lighting ? `Lighting: ${brief.lighting}` : '',
    brief.cameraStyle ? `Camera: ${brief.cameraStyle}` : '',
    brief.productPlacement ? `Product placement: ${brief.productPlacement}` : '',
    concept.visualDirection ? `Concept direction: ${concept.visualDirection}` : '',
    concept.composition ? `Composition: ${concept.composition}` : '',
    model.gender || model.clothing
      ? `Human model visual attributes as supplied by the user only: ${JSON.stringify({
          gender: model.gender,
          ageRange: model.ageRange,
          clothing: model.clothing,
          expression: model.expression,
          pose: model.pose,
          profession: model.profession,
          visualIdentity: model.visualIdentity,
        })}`
      : 'No human model unless the concept requires one.',
    variation?.preserve?.length ? `Preserve exactly: ${variation.preserve.join(', ')}` : '',
    variation?.changes?.length ? `Change only: ${variation.changes.join(', ')}` : '',
    input.userInstructions ? `User instruction: ${input.userInstructions}` : '',
    input.internalConstraints,
    'Match product identity, packaging, logo, colors, and visible labels from reference images when provided.',
  ]
    .filter(Boolean)
    .join('\n');

  return { userVisible: userVisible || input.productName, providerPrompt };
}

export function variationFromInstruction(instruction: string) {
  return parseEditIntent(instruction);
}
