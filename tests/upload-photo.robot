*** Settings ***
Documentation     Tests for US #9 
Library           SeleniumLibrary
Library           OperatingSystem
Suite Setup       Open Smart Album
Suite Teardown    Close All Browsers
Test Setup        Go To Albums Page

${ALBUMS_URL}         http://localhost:5173
${BROWSER}            chrome
${DATA_DIR}           ${CURDIR}${/}..${/}test_data

${ALBUM_SELECT}       id:pu-album
${FILE_INPUT}         css:input[type="file"]
${UPLOAD_BTN}         css:.pu-actions .pu-btn--primary
${NOTICE}             css:.pu-notice
${QUEUED_ITEMS}       css:.pu-item
${DONE_ITEMS}         css:.pu-item[data-status="done"]
${GALLERY_COUNT}      css:.pg-subtitle


Upload Several Photos At Once
    [Documentation]    TC-01, AC-1/AC-2/AC-3 (photos of all four types upload in one batch)
    [Tags]    US-9    upload    TC-01
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Select Photo File    sample.gif
    Select Photo File    sample.webp
    Element Count Should Be    ${QUEUED_ITEMS}    4
    Click Button    ${UPLOAD_BTN}
    Wait Until Element Contains    ${NOTICE}    Uploaded 4 photos    timeout=30s
    Element Count Should Be    ${DONE_ITEMS}    4
    ${expected}=    Evaluate    ${before} + 4
    Photo Count Should Eventually Be    ${expected}

Uploaded Photo Is Still There After Refresh
    [Documentation]    TC-11, AC-3 (uploaded photo not lost when page is reloaded)
    [Tags]    US-9    upload    TC-11
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Click Button    ${UPLOAD_BTN}
    Wait Until Element Contains    ${NOTICE}    Uploaded 1 photo    timeout=30s
    ${expected}=    Evaluate    ${before} + 1
    Photo Count Should Eventually Be    ${expected}
    Reload Page
    Photo Count Should Eventually Be    ${expected}

Non Image File Is Rejected
    [Documentation]    TC-04, AC-4 (pdf file not accepted)
    [Tags]    US-9    upload    TC-04
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Select Photo File    not_an_image.pdf
    Wait Until Element Contains    ${NOTICE}    is not a JPG, PNG, GIF or WebP image
    Element Count Should Be    ${QUEUED_ITEMS}    0

Valid Photos Still Upload When One File Is Rejected
    [Documentation]    TC-05, AC-4
    [Tags]    US-9    upload    TC-05
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Select Photo File    not_an_image.pdf
    Wait Until Element Contains    ${NOTICE}    is not a JPG, PNG, GIF or WebP image
    Element Count Should Be    ${QUEUED_ITEMS}    2

Photo Over 10 MB Is Rejected
    [Documentation]    TC-07, AC-5
    [Tags]    US-9    upload    TC-07
    ${big}=    Set Variable    ${TEMPDIR}${/}too_big.png
    Create Binary File    ${big}    ${{ b'0' * (11 * 1024 * 1024) }}
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Select File By Path    ${big}
    Wait Until Element Contains    ${NOTICE}    is larger than 10 MB
    Element Count Should Be    ${QUEUED_ITEMS}    0
    [Teardown]    Remove File    ${big}

No Upload Button Before Any Photo Is Selected
    [Documentation]    TC-09, AC-7
    [Tags]    US-9    upload    TC-09
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Page Should Not Contain Element    ${UPLOAD_BTN}



Open Smart Album
    Open Browser    ${ALBUMS_URL}    ${BROWSER}
    Set Window Size    1280    900

Go To Albums Page
    Go To    ${ALBUMS_URL}
    Wait Until Page Contains    Photo albums

Create Album
    [Arguments]    ${name}
    Click Button    css:.am-header button.am-btn--primary
    Wait Until Element Is Visible    id:album-name
    Input Text    id:album-name    ${name}
    Click Button    xpath://dialog//button[normalize-space()='Create album']
    Wait Until Element Is Not Visible    id:album-name

Go To Upload Page
    [Arguments]    ${album_name}
    Go To    ${ALBUMS_URL}/#/upload
    Wait Until Element Is Visible    ${ALBUM_SELECT}
    Select From List By Label    ${ALBUM_SELECT}    ${album_name}

Select Photo File
    [Documentation]    Gives one file from test_data/ to the upload field. Files picked one after
    ...                another collect in the list, then one click on Upload sends them all.
    [Arguments]    ${file_name}
    Select File By Path    ${DATA_DIR}${/}${file_name}

Select File By Path
    [Arguments]    ${path}
    ${path}=    Normalize Path    ${path}
    Execute Javascript
    ...    var i = document.querySelector('input[type="file"]');
    ...    i.style.display = 'block'; i.style.visibility = 'visible'; i.style.opacity = '1';
    ...    i.style.position = 'static'; i.style.width = 'auto'; i.style.height = 'auto';
    Choose File    ${FILE_INPUT}    ${path}

Element Count Should Be
    [Arguments]    ${locator}    ${expected}
    Wait Until Keyword Succeeds    5s    500ms    Count Equals    ${locator}    ${expected}

Count Equals
    [Arguments]    ${locator}    ${expected}
    ${n}=    Get Element Count    ${locator}
    Should Be Equal As Integers    ${n}    ${expected}

Get Photo Count
    Go To    ${ALBUMS_URL}/#/photos
    Wait Until Element Is Visible    ${GALLERY_COUNT}
    Sleep    1s    # give the page a moment to load the photos
    ${text}=    Get Text    ${GALLERY_COUNT}
    ${count}=    Evaluate    int($text.split()[0])
    RETURN    ${count}

Photo Count Should Be
    [Arguments]    ${expected}
    ${count}=    Get Photo Count
    Should Be Equal As Integers    ${count}    ${expected}

Photo Count Should Eventually Be
    [Arguments]    ${expected}
    Wait Until Keyword Succeeds    20s    2s    Photo Count Should Be    ${expected}

Unique Album Name
    ${stamp}=    Get Time    epoch
    RETURN    QA Album ${stamp}
