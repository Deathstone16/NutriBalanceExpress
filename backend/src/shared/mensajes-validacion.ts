import { z } from 'zod';

/**
 * Mensajes de validación en español pensados para quien completa un formulario.
 * Los mensajes explícitos de cada esquema (por ejemplo el del DNI) tienen prioridad sobre estos.
 */
z.config({
  localeError: issue => {
    switch (issue.code) {
      case 'invalid_type':
        return issue.input === undefined || issue.input === null ? 'Completá este campo.' : 'El valor ingresado no es válido.';
      case 'too_small': {
        const minimo = Number(issue.minimum);
        if (issue.origin === 'string') return minimo <= 1 ? 'Completá este campo.' : `Ingresá al menos ${minimo} caracteres.`;
        if (issue.origin === 'array') return 'Elegí al menos una opción.';
        return issue.inclusive ? `El valor debe ser ${minimo} o más.` : `El valor debe ser mayor que ${minimo}.`;
      }
      case 'too_big': {
        const maximo = Number(issue.maximum);
        if (issue.origin === 'string') return `Ingresá hasta ${maximo} caracteres.`;
        return issue.inclusive ? `El valor debe ser ${maximo} o menos.` : `El valor debe ser menor que ${maximo}.`;
      }
      case 'invalid_format':
        if (issue.format === 'email') return 'Ingresá un correo válido, por ejemplo nombre@dominio.com.';
        if (issue.format === 'datetime' || issue.format === 'date') return 'Ingresá una fecha válida.';
        return 'El formato ingresado no es válido.';
      case 'invalid_value':
        return 'Elegí una opción válida.';
      case 'unrecognized_keys':
        return 'Hay un dato que no corresponde a este formulario.';
      default:
        return 'El valor ingresado no es válido.';
    }
  },
});
