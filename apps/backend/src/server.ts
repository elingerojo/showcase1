// server.ts
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { deepseek } from '@ai-sdk/deepseek';
import { ToolLoopAgent, isStepCount } from 'ai';
import { z } from 'zod';

// Parse variables and provide default fallbacks
const PORT = parseInt(process.env.PORT || '3000', 10) || 3000;
const HOST = process.env.HOST || 'localhost';

const app = express();
app.use(cors());
app.use(express.json());



// Define a GET route at the root URL '/'
app.get('/', (req, res) => {
    res.send('Yupi!');
});

app.post('/api/agent/agui-stream', async (req, res) => {
  const { messages } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  res.write(`data: ${JSON.stringify({ event: 'AGUI_LIFECYCLE', status: 'started', agent: 'calculator-agent' })}\n\n`);

  try {
    const agent = new ToolLoopAgent({
      model: deepseek('deepseek-v4-flash'),
      instructions: 'You are bad at precise math. For any arithmetic, calculation, or quantitative evaluation, you MUST use this calculator tool. Execute all aritmetic operations strictly using these tool.',
      providerOptions: {
        deepseek: {
          thinking: { type: 'disabled' }
        },
      },
      tools: {
        calculator: {
          description: 'Calculate arithmetic expressions: addition, subtraction, multiplication, division.',
          inputSchema: z.object({
            op: z.enum(['add', 'sub', 'mul', 'div']),
            a: z.number(),
            b: z.number(),
          }),
          execute: async ({ op, a, b }: { op: string; a: number; b: number }) => {
            res.write(`data: ${JSON.stringify({ event: 'AGUI_TOOL_CALL', tool: 'calculator', args: { op, a, b } })}\n\n`);
            
            let resNum = 0;
            if (op === 'add') resNum = a + b;
            if (op === 'sub') resNum = a - b;
            if (op === 'mul') resNum = a * b;
            if (op === 'div') resNum = b !== 0 ? a / b : NaN;

            res.write(`data: ${JSON.stringify({ event: 'AGUI_TOOL_RESULT', tool: 'calculator', res: resNum })}\n\n`);

            return { result: resNum };
          },
        },
      },
      stopWhen: isStepCount(10),
      prepareStep: async ({ stepNumber }) => {
        if (stepNumber === 0) {
          return { toolChoice: { type: 'tool', toolName: 'calculator' } };
        }
        return { toolChoice: 'auto' };
      },
    });

    const result = await agent.stream({ messages });


    // Reemplaza el bucle for await anterior por esta estructura exacta:
    for await (const part of result.stream) {
      switch (part.type) {
        case 'text-delta':
          // Se extrae textDelta de forma segura dentro del bloque tipado
          res.write(`data: ${JSON.stringify({ event: 'AGUI_TEXT_DELTA', text: part.text })}\n\n`);
          break;

        case 'reasoning-delta':
          // CORRECCIÓN: El SDK de Vercel expone el token de razonamiento en part.text
          res.write(`data: ${JSON.stringify({ event: 'AGUI_REASONING_DELTA', reasoning: part.text })}\n\n`);
          break;

        case 'tool-call':
          // SOLUCIÓN DE TIPADO: Evaluamos de forma segura si los argumentos ya están listos en el stream
          const toolPart = part as any;
          if (toolPart.toolName === 'executeMath' && toolPart.args) {
            res.write(`data: ${JSON.stringify({ 
              event: 'AGUI_TOOL_CALL', 
              tool: toolPart.toolName, 
              args: toolPart.args 
            })}\n\n`);
          }
          break;
              
        default:
          // Ignorar otros tipos de eventos del stream (como finish o tool-result) si no los requieres
          break;
      }
    }


    res.write(`data: ${JSON.stringify({ event: 'AGUI_LIFECYCLE', status: 'completed' })}\n\n`);
  } catch (error) {
    res.write(`data: ${JSON.stringify({ event: 'AGUI_ERROR', message: (error as Error).message })}\n\n`);
  } finally {
    res.end();
  }
});

app.listen(PORT, HOST, () => console.log('AG-UI Agent Server operational.'));
