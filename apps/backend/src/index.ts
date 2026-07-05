import express, { Request, Response } from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hola desde TypeScript Express!');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
