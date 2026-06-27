import { AiCostService } from './ai-cost.service';

describe('AiCostService', () => {
  it('records estimated cost and token usage', async () => {
    const create = jest.fn().mockResolvedValue({ costCents: 9 });
    const service = new AiCostService({ aiCostEvent: { create } } as any);
    await service.record({ teamId: 'team', provider: 'openai-compatible', model: 'model', operation: 'chat', promptTokens: 1000, completionTokens: 2000 });
    expect(create).toHaveBeenCalledWith({ data: expect.objectContaining({ teamId: 'team', promptTokens: 1000, completionTokens: 2000, costCents: 9 }) });
  });
});
