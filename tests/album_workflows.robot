*** Settings ***
Documentation     Shared-file membership, saved order, collage and non-destructive deletion regressions.
Resource          album.resource
Suite Setup       Open Smart Album
Suite Teardown    Close All Browsers
Test Setup        Go To Albums Page
Test Teardown     Run Keyword If Test Failed    Capture Page Screenshot

*** Test Cases ***
Library Copies Preserve Source Order And Work In Collages
    [Tags]    US-2    US-4    US-6    US-7    US-21
    ${source}=    Unique Album Name
    Create Album    ${source}
    ${before}=    Get Photo Count
    Go To Upload Page    ${source}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Select Photo File    sample.gif
    Select Photo File    sample.WEBP
    Upload Queued Photos    4
    Go To Albums Page
    Open Album    ${source}
    Count Equals    css:.pg-tile    4
    ${second}=    Get Element Attribute    xpath:(//button[contains(@class,'pg-tile')]/img)[2]    src
    Click Button    xpath://button[normalize-space()='Edit photo order']
    Click Button    xpath:(//button[normalize-space()='Move earlier'])[2]
    Click Button    xpath://button[normalize-space()='Save photo order']
    Wait Until Element Is Visible    css:.pg-tile
    ${first}=    Get Element Attribute    css:.pg-tile img    src
    Should Be Equal    ${first}    ${second}
    Reload Page
    Wait Until Element Is Visible    css:.pg-tile
    ${first}=    Get Element Attribute    css:.pg-tile img    src
    Should Be Equal    ${first}    ${second}
    Go To Albums Page
    ${target}=    Unique Album Name
    Create Album    ${target}
    Open Album    ${target}
    Wait Until Element Is Enabled    xpath://button[normalize-space()='Add photos from library']
    Click Button    xpath://button[normalize-space()='Add photos from library']
    # Fresh suite data contains only the four source images; Four grid is supported.
    Count Equals    css:fieldset input[type="checkbox"]    4
    FOR    ${index}    IN RANGE    1    5
        Click Element    xpath:(//fieldset//input[@type='checkbox'])[${index}]
    END
    Click Button    xpath://button[normalize-space()='Add selected photos']
    Wait Until Element Is Visible    css:.pg-tile
    Count Equals    css:.pg-tile    4
    Go To Albums Page
    Wait Until Element Contains    css:[aria-label="Open ${target}"] .am-badge    4 photos
    Mouse Over    css:[aria-label="Open ${target}"]
    Click Button    css:[aria-label="Open ${target}"] [aria-label="Create collage"]
    Wait Until Element Is Visible    css:.ac-name input
    Input Text    css:.ac-name input    Copied photo collage
    Click Button    xpath://dialog//button[normalize-space()='Save collage']
    Wait Until Element Contains    css:.ac [role="status"]    Saved
    Click Button    xpath://dialog//button[normalize-space()='Close']
    Reload Page
    Wait Until Element Is Visible    css:[aria-label="Open ${target}"]
    Mouse Over    css:[aria-label="Open ${target}"]
    Wait Until Element Is Visible    css:[aria-label="Open ${target}"] [aria-label="Saved collages (1)"]
    Click Button    css:[aria-label="Open ${target}"] [aria-label="Saved collages (1)"]
    Wait Until Element Is Visible    css:[aria-label="Open collage Copied photo collage"]
    Click Button    css:[aria-label="Open collage Copied photo collage"]
    Wait Until Element Is Visible    css:.sc .ac-stage img
    Count Equals    css:.sc .ac-stage img    4
    Wait Until Keyword Succeeds    10s    200ms    Collage Images Are Decoded
    Capture Page Screenshot    shared-file-collage.png
    Go To Albums Page
    Open Album    ${target}
    Click Button    xpath:(//button[normalize-space()='Remove sample from album'])[1]
    Wait Until Keyword Succeeds    10s    200ms    Count Equals    css:.pg-tile    3
    Click Button    xpath://button[normalize-space()='Single']
    Click Button    xpath://button[normalize-space()='Remove sample from album']
    Wait Until Element Contains    css:.pg-subtitle    2 photos in this album
    Go To Albums Page
    Open Album    ${source}
    Count Equals    css:.pg-tile    4
    Go To Albums Page
    Mouse Over    css:[aria-label="Open ${target}"]
    Click Button    css:[aria-label="Open ${target}"] [aria-label="Delete album"]
    Handle Alert    ACCEPT
    Wait Until Page Does Not Contain Element    css:[aria-label="Open ${target}"]
    Reload Page
    Wait Until Page Contains    Photo albums
    Page Should Not Contain Element    css:[aria-label="Open ${target}"]
    ${expected}=    Evaluate    $before + 4
    Library Should Contain Photos    ${expected}

Session Survives Refresh And Logout Requires Sign In Again
    [Tags]    US-26
    Reload Page
    Wait Until Page Contains    Photo albums
    Click Button    xpath://button[normalize-space()='Log out']
    Wait Until Element Is Visible    id:login-username
    ${status}=    Execute Async Javascript    const done = arguments[arguments.length - 1]; fetch('/api/session', {credentials:'include'}).then(r => done(r.status)).catch(() => done(0));
    Should Be Equal As Integers    ${status}    401
    Execute Javascript    localStorage.setItem('smart-album-user', JSON.stringify({id:'qa-admin',username:'forged',role:'admin'}));
    Reload Page
    Wait Until Element Is Visible    id:login-username
    Page Should Not Contain    Photo albums
    Sign In
    Capture Page Screenshot    signed-in-again.png

*** Keywords ***
Collage Images Are Decoded
    ${loaded}=    Execute Javascript    return [...document.querySelectorAll('.sc .ac-stage img')].every(i => i.complete && i.naturalWidth > 0);
    Should Be True    ${loaded}    Saved collages must load the copied photo files.
