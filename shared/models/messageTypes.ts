// --------------- Types ---------------

export type MathOp = 'add' | 'sub' | 'mul' | 'div';

export interface ExecuteMathArgs {
  op: MathOp;
  a: number;
  b: number;
}

export type AguiEvent =
  | { event: 'AGUI_LIFECYCLE'; status: 'started' | 'completed'; agent?: string }
  | { event: 'AGUI_REASONING_DELTA'; reasoning: string }
  | { event: 'AGUI_TEXT_DELTA'; text: string }
  | { event: 'AGUI_TOOL_CALL'; tool: string; args: ExecuteMathArgs }
  | { event: 'AGUI_TOOL_RESULT'; tool: string; res: number }
  | { event: 'AGUI_ERROR'; message: string };
