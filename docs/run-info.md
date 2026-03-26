  
  ## Autonomus execution: ##
  
  tmux new -s expert
  ./expert-system/scripts/run-sessions.sh

  or

  ./start.sh
  tail -f expert-system/logs/runner.log

  ## Important Claude Code sessions: ##

  * Phase A - Phase B development

  claude --resume 2f4e0b02-5bac-495f-8992-61465045efe1

  * Phase C - development

  claude --resume "autotest-generation-phase-c"
