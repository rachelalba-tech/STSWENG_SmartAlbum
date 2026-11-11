# PRODUCT BACKLOG

## Photo Album Management

### US #1

As a user, I want to create a new photo album so that I can organize and save photos from a particular event

- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** Natt, John
- **Pre-condition:** The user is logged into the application and has navigated to the album creation page or photo library.
- **Scenario 1:** —
- **Post-condition:** A new photo album is created, saved in the user's account, and ready to accept photos.
- **Acceptance Criteria:** When user clicks "Create Album" and submit a title, then a new empty album is saved and displayed.

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Design and implement album creation UI dialog and page route | 3h | — |
| 2 | Develop backend for creating a new photo album | 4h | — |

### US #2

As a user, I want to delete photo albums that I no longer need so that I can only keep the photo albums I want

- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** John
- **Pre-condition:** The user is logged in and viewing an existing photo album.
- **Scenario 1:** —
- **Post-condition:** The specified photo album is permanently removed from the user's account.
- **Acceptance Criteria:** Given an existing photo album, when the user clicks "Delete Album" and confirms, then the album is permanently removed from the user's account.

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions to execute delete | 2hrs | — |

### US #3

As a user, I want to view all my photo albums in one place so that I can easily find, open, and edit them.

- **Status:** Done (PR #7; demo user)
- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** Alwayne and Joed
- **Pre-condition:** User is logged in
- **Scenario 1:** —
- **Post-condition:** All existing photo albums belonging to the user are visible and reachable
- **Acceptance Criteria:** All created photo albums are visible and openable. No missing albums

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 3hrs | — |
| 2 | Frontend view of all the albums | 3hrs | — |

### US #4

As a user I want to edit the order or layout of the pictures in the albums so that I can create a visual story using the pictures

- **Estimate or Story Points:** 3
- **Priority:** High
- **Taken by:** John
- **Pre-condition:** An album containing multiple photos is open in the album editor view.
- **Scenario 1:**

1. The user opens an album
2. User clicks edit album
3. User can drag pictures to their preferred order
4. User clicks save changes
5. Changes are saved and reflected on the album

- **Post-condition:** The modified layout and image order within the album are saved and reflected in the album view.
- **Acceptance Criteria:**

AC1: Any changes made to the order of the pictures in the album are saved and reflected.
AC2: Button labels and edit view are easy to understand and follow

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 4hrs | John |

### US #5

As a user, I want to rename album sections so that their titles describe the pictures they contain.

- **Estimate or Story Points:** 3
- **Priority:** Middle
- **Taken by:** Alwayne
- **Pre-condition:** THe user opened an album
- **Scenario 1:**
1. User opens an album
2. User clicks edit album
3. User changes headline and/or description 
4. Changes are saved in the album
- **Post-condition:** The album section title is updated and saved with the new text.
- **Acceptance Criteria:**

AC1: Any changes made to the album title and description is saved

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #6

As a user I want to add photos to an album so that I can organize my photos into dedicated albums

- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** John
- **Pre-condition:** The user is logged in and viewing their photo library or an album.
- **Scenario 1:** —
- **Post-condition:** The selected photos are added and saved to the target album.
- **Acceptance Criteria:** The added picture can be seen in the album

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 4hrs | — |

### US #7

As a user, I want to remove photos from an album so that I can revise its content without permanently deleting the photos from my library.

- **Status:** Done (PR #17, Joed)
- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** Joed
- **Pre-condition:** The user is viewing a photo album
- **Scenario 1:** —
- **Post-condition:** The chosen photos are not in the album while remaining available in the main photo library
- **Acceptance Criteria:** The photo cannot be seen in the album but can still be found in the photo library

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 4hrs | — |

### US #8

As a user, I want to add headlines and descriptions to the albums so that it can give the user an idea of what is happening in the pictures

- **Estimate or Story Points:** 3
- **Priority:** Low
- **Taken by:** John
- **Pre-condition:** The user has an album open
- **Scenario 1:** —
- **Post-condition:** Headlines and descriptions are added to the album and stored successfully
- **Acceptance Criteria:**

AC1: Headlines and descriptions made by the user are saved
AC2: It is easy to understand where to write the album headlines and descriptions

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 3hrs | John |

## Photo Management

### US #9

As a user, I want to upload multiple photos at once so that I can quickly add pictures to an album.

- **Status:** Done (PR #14, Natt)
- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** Natt
- **Pre-condition:** The user has selected the pictures they want to upload
- **Scenario 1:** —
- **Post-condition:** All selected photos are uploaded to the system
- **Acceptance Criteria:** All uploaded photos are visible on the app. No photos are lost

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 4hrs | — |

### US #10

As a user, I want to view the uploaded photos both in a birds eye view and individually so that I can easily pick images for albums.

- **Status:** Done (PR #15, Alwayne)
- **Estimate or Story Points:** —
- **Priority:** High
- **Taken by:** Alwayne and Natt
- **Pre-condition:** User has already uploaded photos
- **Scenario 1:**
- **Post-condition:** The user can toggle between a grid overview and an expanded single-photo view
- **Acceptance Criteria:** The toggle between the views works and all photos are seen. No lost photos

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| 1 | Backend functions of the feature | 5hrs | — |
| 2 | Frontend view of the feature | 4hrs | — |

### US #11

As a user, I want the system to automatically identify duplicate photos so that I can remove these unnecessary copies

- **Estimate or Story Points:** 5
- **Priority:** Middle
- **Taken by:** Joed and John
- **Pre-condition:** User has uploaded photos to the application
- **Scenario 1:**

1. User is opening their gallery or an album
2. User clicks find duplicate photos
3. System automatically finds and selects the duplicates
4. User is prompted if they want to delete all the duplicates or look through each individually 
  a. If user is looking at a particular picture with duplicates they may choose whether to save the pictures or delete the duplicate

- **Post-condition:** Identical duplicate photos are flagged by the system and user can choose whether to keep or delete them
- **Acceptance Criteria:**

AC1: The system only flags photos with duplicates 
AC2: If the duplicates are deleted from the gallery then they can no longer be found in both the gallery and any album
AC3: If the duplicates are deleted from the album then they can no longer be found in that gallery but may still be found in the gallery

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #12

As a user, I want the system to identify visually similar photos so that I can choose the best image from multiple shots of the same subject or moment

- **Estimate or Story Points:** 5
- **Priority:** Middle
- **Taken by:** Alwayne and Natt
- **Pre-condition:** There are photos in the library that look similar
- **Scenario 1:**

1. User is opening their gallery or an album
2. User clicks find similar photos
3. System automatically finds and groups the pictures that are similar
4. User can look through each set of similar pictures individually and may choose to delete them

- **Post-condition:** Visually similar photos are grouped together, allowing the user to select the preferred image.
- **Acceptance Criteria:**

AC1: The photos being selected by the system are similar in look, or where they were taken
AC2: Any deletions made is reflected in the gallery and the album
AC3: If a photo was deleted in an album it may still be found in the gallery 
AC4: If a photo was deleted in the gallery it can no longer be found anywhere

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #13

As a user, I want the system to flag low-quality photos so that I will know not to include these photos in the curated albums

- **Estimate or Story Points:** 5
- **Priority:** Middle
- **Taken by:** John and Alwayne
- **Pre-condition:** User has uploaded photos into the application
- **Scenario 1:**

1. User is opening their gallery or an album
2.User clicks find low quality photos
3. System automatically finds and selects the low quality pictures
4. User is prompted if they want to delete all the duplicates or look through each individually 
  a. If user is looking at a particular low-quality picture they may choose whether to save the pictures or delete the duplicate

- **Post-condition:** Photos with low resolution, blurriness, or poor exposure are marked with quality warning flags.
- **Acceptance Criteria:**

AC1: The photos picked by the system are blurry, against the light, or hard to understand
AC2: If a photo was deleted in an album it may still be found in the gallery 
AC3: If a photo was deleted in the gallery it can no longer be found anywhere


| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #14

As a user, I want the system to recommend the best photos from the event so that I can create a well curated album without having to manually check every image

- **Estimate or Story Points:** —
- **Priority:** Middle
- **Taken by:** Natt and Joed
- **Pre-condition:** User has uploaded pictures into the application
- **Scenario 1:**
1. User is opening their gallery 
2. User clicks recommend best photos
3. System automatically finds presents the recommended pictures
4. From there the user may add it to any existing album

- **Post-condition:** A list of top-recommended photos is presented to the user.
- **Acceptance Criteria:**

AC1: The pictures chosen by the system have little to no visual flaws and are clear
AC2: If the user adds a photo to an album from the curated list made by the system, the new pictures should be added and seen on the chosen album

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #15

As a user, I want to drag and drop photos onto albums so that I can easily design my album

- **Estimate or Story Points:** —
- **Priority:** Low
- **Taken by:** —
- **Pre-condition:** User has uploaded photos into the system and has at least one album.
- **Scenario 1:** —
- **Post-condition:** Dragged photos are placed onto specified album page locations and saved.
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #16

As a user, I want to crop photos within album pages so that I do not need to use a separate app to make edits

- **Estimate or Story Points:** —
- **Priority:** Middle
- **Taken by:** —
- **Pre-condition:** A photo is selected within an album page and edit mode is activated.
- **Scenario 1:** —
- **Post-condition:** The cropped version of the photo is updated and rendered on the album page.
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #17

As a user I want to rotate photos within the application so that I do not need to use a separate app to make edits

- **Estimate or Story Points:** —
- **Priority:** Middle
- **Taken by:** —
- **Pre-condition:** User is looking at one photo and has selected to edit via rotate
- **Scenario 1:** —
- **Post-condition:** Edits are saved in the picture. The rotation is seen in the picture
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #18

As a user, I want to add captions to individual photos so that the users can get specific details on what the picture is trying to show

- **Estimate or Story Points:** —
- **Priority:** Low
- **Taken by:** —
- **Pre-condition:** The target photo is placed within an album layout.
- **Scenario 1:** —
- **Post-condition:** The entered caption is attached to the individual photo and displayed below or alongside it.
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #19

As a user, I want to adjust the color grading of individual photos using the system so that I can make edits and improve the look of the pictures without needing another application

- **Estimate or Story Points:** —
- **Priority:** Low
- **Taken by:** —
- **Pre-condition:** A photo in the album is selected and the color grading tool panel is open.
- **Scenario 1:** —
- **Post-condition:** Color grading adjustments are applied and saved for the targeted photo.
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #20

As a user, I want to apply consistent color grading across my entire album so that all photos have a consistent look

- **Estimate or Story Points:** —
- **Priority:** Low
- **Taken by:** —
- **Pre-condition:** Color grading adjustments or preset profiles have been configured in the album settings
- **Scenario 1:** —
- **Post-condition:** The selected color grading theme or adjustments are uniformly applied across all photos in the album
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #21

As a user, I want the system to recommend editorial page layouts based on my selected photos so that I can create professional-looking pages quickly

- **Estimate or Story Points:** 5
- **Priority:** High
- **Taken by:** Natt
- **Pre-condition:** The user has selected the album they want the collage to be based on
- **Scenario 1:Successfully placed the pictures into a template**

1. User is looking at their created albums or has an album open
2. User clicks a button that places the pictures from the album into a collage template
3. The user can see the collage made by the system 
4. The user can change the position of the pictures if they like

- **Scenario 2: System cannot place the pictures into the template because it does not have an exact number of pictures**

1. User is looking at their created albums or has an album open
2. User clicks a button that places the pictures from the album into a collage template
3. System informs the user that the number of photos in the album does not fit with the number of spaces in the collage
4. System suggest how many photos to reduce or add to fit the template

- **Post-condition:** Recommended editorial layout options are generated and displayed for user selection.
- **Acceptance Criteria:**

AC1: Template fits the number of pictures from the album
AC2: The pictures seen in the collage are taken from the right album
AC3: In the case that the number of photos does not match the templates, the system informs the user immediately and does not create the collage
AC4: It is easy to understand where to trigger this function and the process to follow to get the collage


| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

## Exporting Albums

### US #22

As a user, I want to preview my complete album collage before exporting it so that I can verify its pictures and layout

- **Status:** Done (Joed; read-only preview of the album's photos — no collage layouts or export yet)
- **Estimate or Story Points:** 3
- **Priority:** High
- **Taken by:** Joed
- **Pre-condition:** The user has an edited photo album open and ready for review.
- **Scenario 1:** —
- **Post-condition:** A full digital preview mode of the album is shown to the user
- **Acceptance Criteria:**

AC1: The preview stage does not allow users to make changes to the collage
AC2: The preview stage will show an accurate view of what the final product will look like when they export it

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #23

As a user, I want to export my completed photo album so that I can save it on my device

- **Estimate or Story Points:** 4
- **Priority:** High
- **Taken by:** Joed
- **Pre-condition:** The user is viewing a preview of a completed photo album
- **Scenario 1:** —
- **Post-condition:** The photo album file is generated in the requested format and downloaded to the user's device
- **Acceptance Criteria:**

AC1: It is easy to understand how to trigger the exporting and it is easy for the user to follow this process
AC2: The exported collage is of the user’s desired file type
AC3: The photo collage is looks clear and neat even after exporting

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

## User Matrix

### US #24

As an admin I want to be able to upload pictures, delete pictures, edit pictures, and create albums so that other people can add pictures into it

- **Estimate or Story Points:** —
- **Priority:** Middle
- **Taken by:** —
- **Pre-condition:** An administrator user is logged in with admin role privileges active.
- **Scenario 1:** —
- **Post-condition:** Administrative actions (upload, edit, delete pictures, create shared albums) are working
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #25

As a user I want to be able to add pictures to albums, upload pictures, delete pictures, and edit pictures so that I can also decide on which photos to keep.

- **Estimate or Story Points:** —
- **Priority:** Middle
- **Taken by:** —
- **Pre-condition:** A standard user account is logged in
- **Scenario 1:** —
- **Post-condition:** User modifications (uploading, editing, adding, or deleting photos across albums) are saved.
- **Acceptance Criteria:** —

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |

### US #26

As a user and admin I want to be able to log in to my account using my username and password so that I can see the event pictures

- **Estimate or Story Points:** 4
- **Priority:** High
- **Taken by:** Alwayne
- **Pre-condition:** The user or admin is on the login page.
- **Scenario 1:** —
- **Post-condition:** The user or admin is authenticated and redirected to the application
- **Acceptance Criteria:**

AC1: Logging in with the correct credentials gets the user inside the application
AC2: Logging in with wrong credentials gives a prompt to the user to check their email/password or sign up
AC3: The login screen is easy to understand, follow, and navigate

| Task # | Task Description | Effort Estimate | Taken by |
|---|---|---|---|
| — | — | — | — |
