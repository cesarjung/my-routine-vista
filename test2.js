import { parse, isValid, startOfDay } from 'date-fns'; const p = parse('DATA', 'dd/MM/yyyy', new Date()); console.log(isValid(p));
