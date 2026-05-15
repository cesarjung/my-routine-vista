@echo off
echo =========================================
echo Enviando atualizacao para o Github...
echo =========================================
git add .
git commit -m "fix: resolve synchronization issues across Routine, Calendar, Kanban, and Gantt views"
git push
echo =========================================
echo SUCESSO! Pode rodar o Github Actions agora.
echo =========================================
pause
