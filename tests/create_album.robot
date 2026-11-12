*** Settings ***
Documentation     Tests for US #1 (create album) and parts of US #3 (view albums).
...               Written against AlbumManager.tsx.
Library           SeleniumLibrary
Suite Setup       Open Smart Album
Suite Teardown    Close All Browsers
Test Setup        Go To Albums Page


*** Variables ***
# Change ALBUMS_URL to the page that shows "Photo albums".
# Or leave this and run:  robot -v ALBUMS_URL:http://localhost:5173/albums tests/create_album.robot
${ALBUMS_URL}         http://localhost:5173
# Use headlesschrome when running in GitHub Actions (no screen).
${BROWSER}            chrome
${NOT_FOUND_TEXT}     not found

# Locators (how Selenium finds things). All taken from AlbumManager.tsx.
${NEW_ALBUM_BTN}      css:.am-header button.am-btn--primary
${NAME_INPUT}         id:album-name
${CREATE_BTN}         xpath://dialog//button[normalize-space()='Create album']


*** Test Cases ***
Create Button Is Disabled When Name Is Empty
    [Documentation]    US #1: an album cannot be created without a title.
    [Tags]    US-1    create-album
    Open Create Album Dialog
    Element Should Be Disabled    ${CREATE_BTN}

Create Button Is Disabled When Name Is Only Spaces
    [Documentation]    A title made of spaces should not count as a title.
    [Tags]    US-1    create-album
    Open Create Album Dialog
    Input Text    ${NAME_INPUT}    ${SPACE}${SPACE}${SPACE}
    Element Should Be Disabled    ${CREATE_BTN}

Created Album Appears In The List
    [Documentation]    US #1: after submitting a title, the new album is displayed.
    [Tags]    US-1    create-album
    ${name}=    Unique Album Name
    Create Album    ${name}
    Album Card Should Be Visible    ${name}

Created Album Can Be Opened
    [Documentation]    US #1 and US #3: the album must be saved and openable.
    ...                KNOWN BUG: opening a new album shows "album not found".
    ...                This test is expected to FAIL until the bug is fixed.
    [Tags]    US-1    US-3    create-album    known-bug
    ${name}=    Unique Album Name
    Create Album    ${name}
    Click Element    css:[aria-label="Open ${name}"]
    Sleep    1s    # give the page a moment to show an error, if there is one
    Page Should Not Contain    ${NOT_FOUND_TEXT}


*** Keywords ***
Open Smart Album
    Open Browser    ${ALBUMS_URL}    ${BROWSER}
    Set Window Size    1280    900

Go To Albums Page
    Go To    ${ALBUMS_URL}
    Wait Until Page Contains    Photo albums

Open Create Album Dialog
    Click Button    ${NEW_ALBUM_BTN}
    Wait Until Element Is Visible    ${NAME_INPUT}

Create Album
    [Arguments]    ${name}
    Open Create Album Dialog
    Input Text    ${NAME_INPUT}    ${name}
    Click Button    ${CREATE_BTN}
    Wait Until Element Is Not Visible    ${NAME_INPUT}

Album Card Should Be Visible
    [Arguments]    ${name}
    Wait Until Element Is Visible    css:[aria-label="Open ${name}"]

Unique Album Name
    # A new name each run, so tests never clash with albums from earlier runs.
    ${stamp}=    Get Time    epoch
    RETURN    QA Album ${stamp}
