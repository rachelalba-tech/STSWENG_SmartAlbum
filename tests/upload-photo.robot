*** Settings ***
Documentation     Real multi-file uploads, persistence, rejection and queue controls (US #9).
Resource          album.resource
Suite Setup       Open Smart Album
Suite Teardown    Close All Browsers
Test Setup        Go To Albums Page
Test Teardown     Run Keyword If Test Failed    Capture Page Screenshot

*** Test Cases ***
Upload Several Photos At Once
    [Tags]    US-9    TC-01
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Select Photo File    sample.gif
    Select Photo File    sample.WEBP
    Count Equals    css:.pu-item    4
    Upload Queued Photos    4
    ${expected}=    Evaluate    $before + 4
    Library Should Contain Photos    ${expected}
    Capture Page Screenshot    uploaded-images.png

Uploaded Photo Is Still There After Refresh
    [Tags]    US-9    TC-11
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Upload Queued Photos    1
    ${expected}=    Evaluate    $before + 1
    Library Should Contain Photos    ${expected}
    Reload Page
    Wait Until Element Is Visible    css:.pg-subtitle
    Library Should Contain Photos    ${expected}

Rotate An Uploaded Photo And Persist The Result
    [Tags]    US-17
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Upload Queued Photos    1
    Go To Albums Page
    Open Album    ${album}
    Click Button    css:.pg-tile
    Wait Until Keyword Succeeds    10s    200ms    Photo Is Decoded
    ${original}=    Execute Javascript    const i = document.querySelector('.pg-photo'); return [i.naturalWidth, i.naturalHeight];
    Click Button    css:[aria-label="Rotate clockwise"]
    Click Button    xpath://button[normalize-space()='Save changes']
    Wait Until Element Contains    css:.pg-rotate-status    Rotation saved
    Reload Page
    Wait Until Element Is Visible    css:.pg-tile
    Click Button    css:.pg-tile
    Wait Until Keyword Succeeds    10s    200ms    Photo Is Decoded
    ${rotated}=    Execute Javascript    const i = document.querySelector('.pg-photo'); return [i.naturalHeight, i.naturalWidth];
    Should Be Equal    ${rotated}    ${original}

Non Image File Is Rejected
    [Tags]    US-9    TC-04
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Select Photo File    not_an_image.pdf
    Wait Until Element Contains    ${NOTICE}    is not a JPG, PNG, GIF or WebP image
    Count Equals    css:.pu-item    0

Valid Photos Still Upload When One File Is Rejected
    [Tags]    US-9    TC-05
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Select Photo File    not_an_image.pdf
    Wait Until Element Contains    ${NOTICE}    is not a JPG, PNG, GIF or WebP image
    Count Equals    css:.pu-item    2
    Upload Queued Photos    2
    ${expected}=    Evaluate    $before + 2
    Library Should Contain Photos    ${expected}

Photo Over 10 MB Is Rejected
    [Tags]    US-9    TC-07
    ${id}=    Evaluate    uuid.uuid4().hex    modules=uuid
    ${big}=    Set Variable    ${TEMPDIR}${/}smartalbum-${id}.png
    Create Binary File    ${big}    ${{ b'0' * (10 * 1024 * 1024 + 1) }}
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Choose File    css:input[type="file"]    ${big}
    Wait Until Element Contains    ${NOTICE}    is larger than 10 MB
    Count Equals    css:.pu-item    0
    [Teardown]    Run Keywords    Run Keyword If Test Failed    Capture Page Screenshot    AND    Remove File    ${big}

No Upload Button Before Any Photo Is Selected
    [Tags]    US-9    TC-09
    ${album}=    Unique Album Name
    Create Album    ${album}
    Go To Upload Page    ${album}
    Page Should Not Contain Element    ${UPLOAD_BTN}

Removing A Queued Photo Does Not Upload It
    [Tags]    US-9
    ${album}=    Unique Album Name
    Create Album    ${album}
    ${before}=    Get Photo Count
    Go To Upload Page    ${album}
    Select Photo File    sample.jpg
    Select Photo File    sample.png
    Click Button    css:[aria-label="Remove sample.jpg"]
    Count Equals    css:.pu-item    1
    Upload Queued Photos    1
    ${expected}=    Evaluate    $before + 1
    Library Should Contain Photos    ${expected}

Upload Photo Without Selecting An Album
    [Tags]    US-9
    ${before}=    Get Photo Count
    Go To    ${ALBUMS_URL}/#/upload
    Wait Until Element Is Visible    id:pu-album
    List Selection Should Be    id:pu-album    No album (Photos only)
    Select Photo File    sample.png
    Upload Queued Photos    1
    Wait Until Element Is Visible    link:View in Photos
    Click Link    View in Photos
    ${expected}=    Evaluate    $before + 1
    Library Should Contain Photos    ${expected}
    Reload Page
    Wait Until Element Is Visible    css:.pg-subtitle
    Library Should Contain Photos    ${expected}

*** Keywords ***
Photo Is Decoded
    ${loaded}=    Execute Javascript    return (document.querySelector('.pg-photo')?.naturalWidth ?? 0) > 0;
    Should Be True    ${loaded}
