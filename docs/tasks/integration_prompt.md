# Example 


You need to add support of one more additional project (PMT aka PM Tool aka Project Management Tool) to this expert system. PMT is internal corporate project integrated via  
  API with main project under test - TTT. Access for now will be only via UI, all necessary details are provided in config/pmt/* files. Besides  
  that, some documentation available in confluence: https://projects.noveogroup.com/spaces/NOV/pages/18944057/Project+Management+Tool (entry point).       
  Basically, this project should be treated the same way as TTT, but lightweight. Only episodic chosen UI steps on PMT side as a part of complex  
  E2E PMT-TTT integration testcases will be required. Examples: 1) change of project parameters on PMT side and validation of                
  syncronization on TTT side; 2) creation of new project on PM side and validation of this project addition and functionality on TTT side. 
  Important note: term project in those examples means any abstract project (basically record of project's settings) as entity inside our integrated system (PMT + TTT). 
  Access via UI with the same Admin username/password will be enough. 
  So, you need to add information about this additional integrated project PMT to all prompt/context files of expert system (CLAUDE, CLAUDE+, MISSION_DIRECTIVE, README etc.) 
  Pay attention to multi-project architecture of autotests: proper separation from TTT-related code must be done (pageobjects, fixtures etc) similar to CS project.
  As for test-docs, no special project level is required: integrated tests will be mix of steps on different projects. Feel free to ask questions.