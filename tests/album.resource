*** Settings ***
Library           SeleniumLibrary
Library           OperatingSystem

*** Variables ***
${ALBUMS_URL}      http://127.0.0.1:4173
${BROWSER}         headlesschrome
${DATA_DIR}        ${CURDIR}${/}test_data
${USERNAME}        test
${PASSWORD}        tester123
${NAME_INPUT}      id:album-name
${CREATE_BTN}      xpath://dialog//button[normalize-space()='Create album']
${UPLOAD_BTN}      css:.pu-actions .pu-btn--primary
${NOTICE}          css:.pu-notice

*** Keywords ***
Open Smart Album
    # Never run mutation suites against a deployed application.
    ${local}=    Evaluate    urllib.parse.urlparse($ALBUMS_URL).hostname in ('localhost', '127.0.0.1')    modules=urllib.parse
    Should Be True    ${local}    Browser tests require an isolated loopback server.
    Open Browser    ${ALBUMS_URL}    ${BROWSER}    options=add_argument("--no-sandbox");add_argument("--disable-dev-shm-usage")
    Set Window Size    1280    900
    Set Selenium Timeout    10s
    Sign In

Sign In
    Wait Until Element Is Visible    id:login-username
    Input Text    id:login-username    ${USERNAME}
    Input Password    id:login-password    ${PASSWORD}
    Click Button    css:.login-form button[type="submit"]
    Wait Until Page Contains    Photo albums

Go To Albums Page
    Go To    ${ALBUMS_URL}/#/
    Reload Page
    Wait Until Page Contains    Photo albums

Open Create Album Dialog
    Click Button    css:.am-header button.am-btn--primary
    Wait Until Element Is Visible    ${NAME_INPUT}

Create Album
    [Arguments]    ${name}
    Open Create Album Dialog
    Input Text    ${NAME_INPUT}    ${name}
    Click Button    ${CREATE_BTN}
    Wait Until Element Is Not Visible    ${NAME_INPUT}
    Wait Until Element Is Visible    css:[aria-label="Open ${name}"]

Unique Album Name
    ${id}=    Evaluate    uuid.uuid4().hex    modules=uuid
    RETURN    QA Album ${id}

Open Album
    [Arguments]    ${name}
    Click Element    css:[aria-label="Open ${name}"]
    Wait Until Element Contains    css:article.album h2    ${name}
    Wait Until Element Is Visible    css:.pg-subtitle

Go To Upload Page
    [Arguments]    ${album}
    Go To    ${ALBUMS_URL}/#/upload
    Wait Until Element Is Visible    id:pu-album
    Select From List By Label    id:pu-album    ${album}

Select Photo File
    [Arguments]    ${name}
    ${file}=    Normalize Path    ${DATA_DIR}${/}${name}
    File Should Exist    ${file}
    Choose File    css:input[type="file"]    ${file}

Upload Queued Photos
    [Arguments]    ${count}
    Click Button    ${UPLOAD_BTN}
    Wait Until Element Contains    ${NOTICE}    Uploaded ${count} photo    timeout=30s
    Count Equals    css:.pu-item[data-status="done"]    ${count}

Count Equals
    [Arguments]    ${locator}    ${expected}
    ${actual}=    Get Element Count    ${locator}
    Should Be Equal As Integers    ${actual}    ${expected}

Get Photo Count
    Go To    ${ALBUMS_URL}/#/photos
    Wait Until Element Is Visible    css:.pg-subtitle
    ${text}=    Get Text    css:.pg-subtitle
    ${count}=    Evaluate    int($text.split()[0])
    RETURN    ${count}

Library Should Contain Photos
    [Arguments]    ${expected}
    ${count}=    Get Photo Count
    Should Be Equal As Integers    ${count}    ${expected}
    Count Equals    css:.pg-tile    ${expected}
    Wait Until Keyword Succeeds    10s    200ms    Gallery Images Are Decoded

Gallery Images Are Decoded
    ${loaded}=    Execute Javascript    return [...document.querySelectorAll('.pg-tile img')].every(i => i.complete && i.naturalWidth > 0);
    Should Be True    ${loaded}    Uploaded images must load from the authenticated API.
