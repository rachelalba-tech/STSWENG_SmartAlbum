**Project Proposals and Standards**  

| Team Number | 16 |
| :---- | :---- |
| **Section** | S06 |
| **Team Members** | Abogadie, Niña Rica  T. Alba, Rachel Angeline  S. Dacanay, Alwayne Esteviel L. Llamas, John Christian C. Pasigan, Maria Elisa P. Sandoval, Roy Louis N. Valle, Jose Edgardo                     |

**Proposed Application Description**

Photos taken during events are tedious to organize, clean up, and compile into neat albums that capture the key parts of the event. There may be several people taking pictures during the event and so it is difficult to find a convenient way for the photos to be shared to all participants as well as curate the pictures so that only the best photos are kept and the viewers do not need to spend a long time looking for specific moments. While current photo gallery applications help solve this problem they only store and share the photos. As such our proposed application aims to go a step above these applications by adding features that make organizing these photos easier. These features include identifying the best photos, organizing the photos into comprehensible sections, and creating a consistent color treatment. 

The target demographic of the application are event hosts, planners, and event participants. The app’s main features consists of the following:

**Photo Editing**: Users will be able to upload photos into the application and make edits to them within the app. Editing features include cropping, rotating, and color grading.

**Photo Album Management**: Users will be able to create albums wherein pictures can be arranged and placed in layout. This allows users to organize photos based on specific moments and create photo collage pages with the photos in the album. The retrieval of a photo’s metadata such as the time and place where it was taken will primarily be used to organize photos chronologically.

**Photo Analysis**: The application can flag duplicate/similar photos, flag low-quality pictures and give recommendations for which are the best photos. This is to ease the process of cleaning up photo albums and choosing which photos to keep. 

	The app will have two kinds of users, the administrator role and the user role. The role of the administrator is to create and label different albums that each follow their separate criteria for proper organization. Once the albums have been created, users will be able to upload photos that are to be organized into the existing albums.

**Team Standards and Workflow**

**Git Workflow** 

* Main Branch: The main branch will contain the stable version of the project. Developers should not push changes directly to this branch.  
* Test/Modified Branches: Each developer should create a separate branch when working on a new feature, fixing a bug, or making changes to the existing code. The commit is to only be added to the main branch once checked by QA’s or Team leaders to avoid pulling a version full of bugs.  
* Branch Naming: Branches should have clear and descriptive names so the team can easily identify their purpose.  
* Pull Requests: Developers/Analysts must submit a pull request when their changes are ready. QA and team leaders must check its functionality and review the code before merging it into the main branch.  
* Testing Before Merging: Developers/Analysts should check that their code compiles and that the relevant tests pass before requesting approval.  
* Keeping Branches Updated: Developers/Analysts should regularly pull the latest changes from the repository to avoid outdated code and reduce merge conflicts.  
* Handling Merge Conflicts: If conflicts occur, the Developers/Analysts involved should review the changes, resolve the conflicts, and test the code before merging.

**CI Server Integration**

* CI Platform: The team will use GitHub Actions as its continuous integration (CI) server. Because the project repository will be hosted on GitHub, GitHub Actions integrates directly with it and allows builds and checks to be triggered automatically by events linked to the repository, without the need for a separate service.   
  * Triggers: The CI pipelines will run automatically whenever a pull request is opened or updated, and whenever changes are pushed to the main or test branches. This makes sure that every change is verified before it is allowed into the stable version of the project.  
  * Pipeline Steps: Each CI run will install the project dependencies, build the application, and run the automated checks and tests, which include linting, formatting checks, unit tests, and end-to-end tests. This helps catch broken or poorly formatted code early.   
  * Path Filtering: Because the application is made up of separate parts, such as the web front end, the back-end server, and the photo analysis module, the pipelines will only run the jobs that are relevant to the files changed in a pull request. This keeps the builds fast and avoids running unnecessary tests.   
  * Required Checks and Branch Protection: The main branch will be protected so that a pull request can only be merged once its CI checks pass and it has been approved by a reviewer. If any job fails, the pull request will be blocked from merging into the main branch.   
  * Cancelling Outdated Runs: When new commits are pushed to an open pull request, any builds still running for the older commits will be cancelled so that only the latest version of the code is tested.

**Automation**

* Automated Builds and Tests: Every pull request and push will automatically build the application and run the test suite, so developers do not need to perform these steps by hand before each merge.   
  * Code Quality Checks: Linting and formatting will be checked automatically on every pull request. The team can also run an automated formatter that applies the agreed code style and pushes the corrections back to the branch, so formatting issues are fixed without manual effort.  
  * Commit and Pull Request Validation: Pull request titles will be validated automatically against the commit convention, and pull requests will be labeled automatically based on the files they change. This keeps the commit history consistent and easy to read.  
  * Dependency Updates: Outdated or vulnerable dependencies will be detected automatically, and update pull requests will be opened by the CI server so that the project stays current with minimal manual work.  
  * Release Automation: When the work of a sprint is ready to be released, the new version will be tagged, release notes will be generated automatically from the commit history, and the deployable build or artifacts will be produced by the pipeline.

   
**Version Control & Commit Conventions**   
	  
To standardize the format of commit messages, the following conventions will be adhered to: 

| `<type>(<optional scope>): <description>   [optional body]     [optional footer]` |
| :---- |

| type | function | example |
| :---- | :---- | :---- |
| feat | A new feature is added to the application. | `feat(album): add drag-and-drop photo reordering` |
| style | Formatting or styling changes that do not affect how the code runs. | `style(web): fix spacing and alignment of the gallery grid` |
| fix | A bug is corrected. | `fix(analysis): correct duplicate photo detection` |
| test | Tests are added or updated. | `test(server): add unit tests for album export` |
| docs | Documentation is added or updated. | `docs: update the setup instructions in the README` |
| refactor | Code is restructured without adding a feature or fixing a bug. | `refactor(editor): extract color grading into a service` |
| chore | Routine maintenance, build, or dependency tasks. | `chore(deps): update the image processing library` |

**Code Reviews (Pull Requests)**  

* **Opening a Pull Request**: When a developer finishes a task, they will open a pull request from their branch into the main branch. The pull request will describe what was changed, why it was changed, and which user story or requirement card it addresses.  
  * **Assigning Reviewers**: At least one QA member or team leader must review the pull request before it can be merged. The reviewer checks that the code works as intended, follows the team's standards, and does not introduce new bugs.  
  * **Review Checklist**: Reviewers will verify that the code compiles, that the relevant tests pass, that the commit messages follow the agreed convention, and that the changes stay focused on a single task instead of mixing unrelated changes.  
  * **Requesting Changes**: If changes are needed, the reviewer will leave comments and mark the pull request as requiring changes. The author will then address the feedback by pushing new commits to the same branch, and the pull request will be reviewed again.  
  * **Approval and Merging**: Once the CI checks pass and the reviewer approves, the pull request can be merged into the main branch. Any merge conflicts will be resolved and tested by the author before the merge.  
  * **Keeping Pull Requests Small**: Pull requests should be kept as small and focused as possible, since smaller changes are easier to review, need fewer corrections, and can be merged faster.

**Team Standards** 

* **Product Owner**: The product owner is responsible for maintaining the product backlog. They must have a comprehensive understanding of the requirements and keep in contact with the client to update them on the status of the project. The product owner will also be in charge of monitoring the status of the project and explaining the requirements to the rest of the team.   
  * **Developer**: The developers are responsible for writing, testing, and documenting the code for the features assigned to them. They will create a separate branch for each task, follow the commit conventions, make sure their code compiles and passes the relevant tests, and open a pull request once their work is ready for review.  
  * **Analyst**: The analyst is responsible for analyzing the needs of the client, communicating their findings to the product owner and other members, and assisting in the creation of the product backlog. They work with the product owner to ensure that requirements are documented and communicated clearly to both the development team and client  
  * **Quality Assurance**: The QA is responsible for creating test plans, executing automated and manual tests, verifying feature functionality against acceptance criteria, and reviewing pull requests to ensure overall software quality and prevent regressions.  
  * **Dev Ops**: DevOps is responsible for configuring and maintaining continuous integration and continuous deployment pipelines, managing repository branch protections, and ensuring smooth release and build processes across all environments.