import os
import subprocess

# Restore the file to original git state
subprocess.run(["git", "checkout", "HEAD", "src/components/views/CarteiraDashboardView.tsx"], check=True)

file_path = "src/components/views/CarteiraDashboardView.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Scrollbar fix
content = content.replace(
    'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto no-scrollbar-custom"',
    'className="flex flex-row flex-nowrap items-end gap-4 overflow-x-auto custom-scrollbar pb-2"'
)

# 2. Card 2
content = content.replace(
    '''        {/* 2. Total de Postes Disponíveis */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col justify-center min-w-[120px]">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Postes Disponíveis</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-foreground">{indicators.sumPostes.toLocaleString('pt-BR')}</p>
              <div className="flex flex-col text-[10px] text-muted-foreground ml-2 mb-1">
                <span>Geral: {indicators.geralSumPostes.toLocaleString('pt-BR')}</span>
                <span className="font-semibold text-primary">Meta: {indicators.sumMetaPostes.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 flex justify-center items-center px-2">
            <span className="text-2xl font-black text-primary">{indicators.percentMeta.toFixed(1)}%</span>
          </div>
          <Gauge value={indicators.sumPostes} max={indicators.sumMetaPostes || indicators.geralSumPostes || 1} colorClass="text-foreground" />
        </div>''',
    '''        {/* 2. Total de Postes Disponíveis */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2">
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Postes Disponíveis">Postes Disponíveis</p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-1 min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-foreground leading-none">{indicators.sumPostes.toLocaleString('pt-BR')}</p>
              <div className="flex flex-col text-[9px] sm:text-[10px] text-muted-foreground sm:ml-1 mb-1 min-w-0">
                <span className="truncate" title={`Geral: ${indicators.geralSumPostes.toLocaleString('pt-BR')}`}>Geral: {indicators.geralSumPostes.toLocaleString('pt-BR')}</span>
                <span className="font-semibold text-primary truncate" title={`Meta: ${indicators.sumMetaPostes.toLocaleString('pt-BR')}`}>Meta: {indicators.sumMetaPostes.toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center items-center px-1 sm:px-2 shrink-0">
            <span className="text-lg sm:text-2xl font-black text-primary">{indicators.percentMeta.toFixed(1)}%</span>
          </div>
          <div className="shrink-0">
            <Gauge value={indicators.sumPostes} max={indicators.sumMetaPostes || indicators.geralSumPostes || 1} colorClass="text-foreground" />
          </div>
        </div>'''
)

# 3. Card 8
content = content.replace(
    '''        {/* 8. Postes / Equipes */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Postes / Equipes</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-bold text-foreground">{indicators.ratioEquipes.toFixed(2)}</p>
              <div className="flex flex-col text-[10px] text-muted-foreground ml-2 mb-1">
                <span>Ut: {indicators.sumPostes} / Eq: {indicators.sumEquipes}</span>
                <span className="font-semibold text-primary">Meta: {indicators.metaPostesEquipeAvg.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <Gauge value={indicators.ratioEquipes} max={indicators.metaPostesEquipeAvg || 1} colorClass="text-foreground" />
        </div>''',
    '''        {/* 8. Postes / Equipes */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2">
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Postes / Equipes">Postes / Equipes</p>
            <div className="flex flex-col sm:flex-row sm:items-end gap-1 min-w-0">
              <p className="text-xl sm:text-3xl font-bold text-foreground leading-none">{indicators.ratioEquipes.toFixed(2)}</p>
              <div className="flex flex-col text-[9px] sm:text-[10px] text-muted-foreground sm:ml-1 mb-1 min-w-0">
                <span className="truncate">Ut: {indicators.sumPostes} / Eq: {indicators.sumEquipes}</span>
                <span className="font-semibold text-primary truncate">Meta: {indicators.metaPostesEquipeAvg.toFixed(1)}</span>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <Gauge value={indicators.ratioEquipes} max={indicators.metaPostesEquipeAvg || 1} colorClass="text-foreground" />
          </div>
        </div>'''
)

# 4. Card 10
content = content.replace(
    '''        {/* 10. Capacidade Faturamento */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between">
          <div className="flex flex-col justify-center min-w-0">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1">Capacidade Faturamento</p>
            <div className="flex flex-col gap-0.5">
              <p className="text-xl sm:text-2xl font-bold text-green-500 truncate" title={indicators.sumFaturamento.toString()}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumFaturamento)}
              </p>
              <div className="text-[10px] text-muted-foreground">
                <span className="font-semibold text-primary" title={`Meta: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(indicators.sumMetaFaturamento)}`}>
                  Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumMetaFaturamento)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0 ml-2">
            <Gauge value={indicators.sumFaturamento} max={indicators.sumMetaFaturamento || indicators.sumFaturamento || 1} colorClass="text-green-500" />
          </div>
        </div>''',
    '''        {/* 10. Capacidade Faturamento */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center justify-between overflow-hidden gap-2">
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-1 truncate" title="Capacidade Faturamento">Capacidade Faturamento</p>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-xl sm:text-2xl font-bold text-green-500 truncate" title={indicators.sumFaturamento.toString()}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumFaturamento)}
              </p>
              <div className="text-[10px] text-muted-foreground overflow-hidden">
                <span className="font-semibold text-primary truncate block" title={`Meta: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(indicators.sumMetaFaturamento)}`}>
                  Meta: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(indicators.sumMetaFaturamento)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <Gauge value={indicators.sumFaturamento} max={indicators.sumMetaFaturamento || indicators.sumFaturamento || 1} colorClass="text-green-500" />
          </div>
        </div>'''
)

# 5. Grid layout
content = content.replace(
    'className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8"',
    'className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mb-8"'
)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
print("Ultimate fix applied.")
