*** Settings ***
Documentation     Persistent album creation, validation, and details (US #1/#3/#8).
Resource          album.resource
Suite Setup       Open Smart Album
Suite Teardown    Close All Browsers
Test Setup        Go To Albums Page
Test Teardown     Run Keyword If Test Failed    Capture Page Screenshot

*** Test Cases ***
Create Button Disabled When Name Is Empty
    [Tags]    US-1
    Open Create Album Dialog
    Element Should Be Disabled    ${CREATE_BTN}

Create Button Disabled When Name Is Only Spaces
    [Tags]    US-1
    Open Create Album Dialog
    Input Text    ${NAME_INPUT}    ${SPACE}${SPACE}${SPACE}
    Element Should Be Disabled    ${CREATE_BTN}

Created Album Persists And Can Be Opened After Refresh
    [Tags]    US-1    US-3
    ${name}=    Unique Album Name
    Create Album    ${name}
    Reload Page
    Wait Until Element Is Visible    css:[aria-label="Open ${name}"]
    Open Album    ${name}
    Wait Until Page Contains    No photos in this album
    Capture Page Screenshot    created-album.png

Album Headline And Description Persist
    [Tags]    US-8
    ${name}=    Unique Album Name
    Create Album    ${name}
    Open Album    ${name}
    Click Button    xpath://button[normalize-space()='Edit album details']
    Input Text    css:article.album form input    ${name} renamed
    Input Text    css:article.album form textarea    Saved description
    Click Button    xpath://button[normalize-space()='Save details']
    Wait Until Element Contains    css:article.album h2    ${name} renamed
    Reload Page
    Wait Until Element Contains    css:article.album h2    ${name} renamed
    Wait Until Page Contains    Saved description
