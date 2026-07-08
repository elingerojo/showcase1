import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'toMD',
  standalone: true
})
export class ToMDPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  /** Wrap inline-markdown segments with their HTML counterparts. */
  private applyInlineMd(text: string): string {
      return (
        text
          // `inline code`  (must be before bold/italic so `**code**` works)
          // .replace(/`([^`]+)`/g, '<code>$1</code>')
          // **bold** or __bold__
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/__(.+?)__/g, '<strong>$1</strong>')
          // *italic* or _italic_
          .replace(/\*(.+?)\*/g, '<em>$1</em>')
          .replace(/_(.+?)_/g, '<em>$1</em>')
          // [text](url)
          /* .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener">$1</a>',
          )*/
          // ~~strikethrough~~
          // .replace(/~~(.+?)~~/g, '<del>$1</del>')
          // newline
          .replace(/\r?\n/g, '<br />')
      );
    }

  private convertMarkdownToHtml(text: string): string {
    if (!text) return '';

      // 3. Block-level patterns (applied line-by-line)
      const lines = text.split('\n');
      const out: string[] = [];
      let inList = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Horizontal rule
        if (/^[-*_]{3,}\s*$/.test(line)) {
          if (inList) { out.push('</ul>'); inList = false; }
          out.push('<hr />');
          continue;
        }

        // Headings
        const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (hMatch) {
          if (inList) { out.push('</ul>'); inList = false; }
          const level = hMatch[1].length;
          const content = this.applyInlineMd(hMatch[2]);
          out.push(`<h${level}>${content}</h${level}>`);
          continue;
        }

        // Blockquote
        if (line.startsWith('> ')) {
          if (inList) { out.push('</ul>'); inList = false; }
          const content = this.applyInlineMd(line.slice(2));
          out.push(`<blockquote>${content}</blockquote>`);
          continue;
        }

        // Unordered list
        const ulMatch = line.match(/^[-*+]\s+(.+)$/);
        if (ulMatch) {
          if (!inList) { out.push('<ul>'); inList = true; }
          out.push(`<li>${this.applyInlineMd(ulMatch[1])}</li>`);
          continue;
        }

        // Ordered list
        const olMatch = line.match(/^\d+\.\s+(.+)$/);
        if (olMatch) {
          if (!inList) { out.push('<ol>'); inList = true; }
          out.push(`<li>${this.applyInlineMd(olMatch[1])}</li>`);
          continue;
        }

        // Regular paragraph line
        if (inList) { out.push('</ul>'); inList = false; }
        const processed = this.applyInlineMd(line);
        out.push(processed || '<br />');
      }

      if (inList) out.push('</ul>');
      return out.join('\n'); // reune todo en un string con newline
  } 

  private transformarLineaLatexAHtml(lineaTexto: string): string {
    let resultado = "";
    let i = 0;

    while (i < lineaTexto.length) {
      const charActual = lineaTexto[i];

      // Detectar patrones de formato: ^ para superíndices o _ para subíndices
      if ((charActual === '^' || charActual === '_') && i + 1 < lineaTexto.length) {
        const siguienteChar = lineaTexto[i + 1];
        const esSuperindice = charActual === '^';
        const etiquetaOpen = esSuperindice ? "<sup>" : "<sub>";
        const etiquetaClose = esSuperindice ? "</sup>" : "</sub>";

        if (siguienteChar === '{') {
          // --- CASO 1: Bloque con llaves ^{...} o _{...} ---
          let inicioContenido = i + 2;
          let nivelLlaves = 1;
          let j = inicioContenido;

          // Buscamos la llave de cierre correspondiente balanceando los niveles
          while (j < lineaTexto.length && nivelLlaves > 0) {
            if (lineaTexto[j] === '{') nivelLlaves++;
            else if (lineaTexto[j] === '}') nivelLlaves--;
            j++;
          }

          if (nivelLlaves === 0) {
            // Extraemos el contenido interno de las llaves
            const contenidoInterno = lineaTexto.substring(inicioContenido, j - 1);
            
            // RECURSIÓN: Procesamos el interior por si combina más ^ o _ anidados
            const contenidoProcesado = this.transformarLineaLatexAHtml(contenidoInterno);
            
            resultado += `${etiquetaOpen}${contenidoProcesado}${etiquetaClose}`;
            i = j; // Avanzamos el puntero al final de este bloque cerrado
            continue;
          }
        } else if (/[a-zA-Z0-9]/.test(siguienteChar)) {
          // --- CASO 2: Carácter único ^x o _x ---
          resultado += `${etiquetaOpen}${siguienteChar}${etiquetaClose}`;
          i += 2; // Avanzamos el puntero pasando el operador y el carácter
          continue;
        }
      }

      // Si no es un patrón de formato, copiamos el carácter tal cual al resultado
      resultado += charActual;
      i++;
    }

    return resultado;
  }

  private convertLatex(input: string): string {
    if (!input) return '';

    let html = input;

    // 1. Escape basic HTML tags inside the input to prevent injection
    html = html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Block math: \[ ... \] -> <div class="math-block">...</div>
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      return `<div class="math-block">${math.trim()}</div>`;
    });

    // 3. Inline math: \( ... \) -> <span class="math-inline">...</span>
    html = html.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
      return `<div class="math-block">${math.trim()}</div>`;
    });
    html = html.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
      return `<span class="math-inline">${math.trim()}</span>`;
    });

    // 4. Fractions: \frac{numerator}{denominator}
    const fracRegex = /\\frac\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
    while (fracRegex.test(html)) {
      html = html.replace(fracRegex, (_, num, den) => {
        return `<span class="math-frac"><span class="math-num">${num}</span><span class="math-den">${den}</span></span>`;
      });
    }

    // 5. Boxed expressions: \boxed{content} -> <span class="math-boxed">content</span>
    // Uses a balanced group matching to allow inner structures (like fractions) inside the box
    const boxedRegex = /\\boxed\s*\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g;
    while (boxedRegex.test(html)) {
      html = html.replace(boxedRegex, (_, content) => {
        return `<span class="math-boxed">${content}</span>`;
      });
    }

    // 6. Text blocks inside math: \text{plain text}
    html = html.replace(/\\text\s*\{([^}]+)\}/g, '<span class="math-text">$1</span>');

    // 7. Division symbol: \div -> &divide; (÷)
    html = html.replace(/\\div\b/g, '&divide;');

    // Pi: \pi -> &pi; (π)
    html = html.replace(/\\pi\b/g, '&pi;');

    // Multiplicación (Cruz): \times -> &times; (×)
    html = html.replace(/\\times\b/g, '&times;');

    // Espacio delgado: \, -> &thinsp;
    html = html.replace(/\\,/g, '&thinsp;');

    // Producto punto : \dot -> &middot;
    html = html.replace(/\\cdot/g, '&middot;');

    // Más o menos : \pm -> &plusm;
    html = html.replace(/\\pm/g, '&plusm;');

    // ==========================================
    // SUBÍNDICES Y SUPERÍNDICES SIMPLES
    // ==========================================

    // Patrón genérico para capturar: contenido entre llaves {texto} o un solo carácter alfanumérico
    const contentPattern = `(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\})|([a-zA-Z0-9])`;
    const supRegex = new RegExp(`\\^${contentPattern}`, 'g');
    /*
    // 1. Superíndices (Potencias / Límites): ^^{texto} o ^x -> <sup>texto</sup>
    const supRegex = new RegExp(`\\^${contentPattern}`, 'g');
    while (supRegex.test(html)) {
      html = html.replace(supRegex, (_, braceContent, singleChar) => {
        return `<sup>${braceContent || singleChar}</sup>`;
      });
    }

    // 2. Subíndices: _{texto} o _x -> <sub>texto</sub>
    const subRegex = new RegExp(`_${contentPattern}`, 'g');
    while (subRegex.test(html)) {
      html = html.replace(subRegex, (_, braceContent, singleChar) => {
        return `<sub>${braceContent || singleChar}</sub>`;
      });
    }
    */

    // Si el buffer contiene al menos un salto de línea
    if (html.includes("\n")) {
      // Dividimos el buffer por saltos de línea
      const lineas = html.split("\n");

      // ¡CRÍTICO! La última posición de la lista siempre estará incompleta 
      // (es el texto que viene después del último \n, o un string vacío)
      lineas.pop();

      // Procesamos únicamente las líneas que ya están 100% cerradas
      let htmlProcesado = "";
      for (const linea of lineas) {
        htmlProcesado += this.transformarLineaLatexAHtml(linea) + "<br />"; // O la etiqueta de bloque que uses
      }

      html = htmlProcesado
    }

    return html;
  }


  transform(value: string): SafeHtml {
    //---------------

    if (!value) return '';

    const mathBlocks: string[] = [];
    let placeholderCount = 0;
    let processedText = value;

    // 1. EXTRAER: Buscar LaTeX y guardarlo en un arreglo para protegerlo
    // Captura tanto \[ ... \] como \( ... \)
    const latexRegex = /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;
    
    processedText = processedText.replace(latexRegex, (match) => {
      const token = `%%MATHPLACEHOLDER${placeholderCount}%%`;
      mathBlocks.push(match);
      placeholderCount++;
      return token;
    });

    // 2. CONVERTIR MARKDOWN: Aquí usas tu librería de Markdown (ej. marked)
    // Para el ejemplo, simulamos la conversión de Markdown a HTML:
    //let htmlOutput = this.convertMarkdownToHtml(processedText);
    let htmlOutput = this.applyInlineMd(processedText);

    // 3. REINJECTAR Y CONVERTIR LATEX: Reemplazar los tokens con el HTML de LaTeX
    for (let i = 0; i < mathBlocks.length; i++) {
      const token = `%%MATHPLACEHOLDER${i}%%`;
      // Convertimos el LaTeX original a HTML usando tu convertidor de Regex
      const latexHtml = this.convertLatex(mathBlocks[i]);
      
      // Colocamos el HTML matemático final en su lugar correspondiente
      htmlOutput = htmlOutput.replace(token, latexHtml);
    }

    //----------------
    return this.sanitizer.bypassSecurityTrustHtml(htmlOutput)
  }
}
