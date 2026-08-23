export interface UnidadePlanejamento {
  nome: string;
  id: string;
  baseNome: string;
  baseLatitude: number;
  baseLongitude: number;
}

export const UNIDADES_PLANEJAMENTO: UnidadePlanejamento[] = [
  { nome: 'BARREIRAS', id: '1OTHF2ytEOjGgfE49paARXkz9GjaklOQC_UhiXwUjC2E', baseNome: 'Base Barreiras', baseLatitude: -12.14863, baseLongitude: -44.99781 },
  { nome: 'BOM JESUS DA LAPA', id: '1rj2V7CxbZwkan63eCeLkH9G00Gi041IZNC6vwEgq6yI', baseNome: 'Base Bom Jesus da Lapa', baseLatitude: -13.25501, baseLongitude: -43.42314 },
  { nome: 'GUANAMBI', id: '1FO5tyhXygbbzSmmTGdnm45j4DD_rRFQgEheN8T8Wy70', baseNome: 'Base Guanambi', baseLatitude: -14.22332, baseLongitude: -42.78143 },
  { nome: 'IBOTIRAMA', id: '1dNwj8qWTl1k92PxI9iXwaNZYITnxuKP-kOF1QnZK3Iw', baseNome: 'Base Ibotirama', baseLatitude: -12.18531, baseLongitude: -43.22062 },
  { nome: 'JEQUIE', id: '1sGHf-zWXoxjnO20QBw2KWX39BSCzT8rzHdEz1hL7jyU', baseNome: 'Base Jequié', baseLatitude: -13.85750, baseLongitude: -40.08390 },
  { nome: 'VITORIA DA CONQUISTA', id: '1XmpY8mqkRou-CRY68j1ljHH8W8zcROy7wnwMMSfbV7o', baseNome: 'Base Vitória da Conquista', baseLatitude: -14.86610, baseLongitude: -40.83940 },
  { nome: 'ITAPETINGA', id: '1rzT8o6XZi4v8j7CYLky3BD3sT5IPjv1PRb45ipBfbw4', baseNome: 'Base Itapetinga', baseLatitude: -15.24860, baseLongitude: -40.24780 },
];
