port module Panel exposing (..)

import Html exposing (program)
import Html exposing (div, span, text)
import Html.Events as Events exposing (onClick)
import Html.Attributes as Attributes exposing (style)
import Models exposing (..)
import LocalStore
import Dict
-- import FontAwesome.Web as Icon


type ActionType
    = EnterText
    | Click


type alias PickingResult =
    { primaryPick : Int
    , elements : List Element
    , selector : String
    , parentOffset : Int
    , id : String
    }


type alias Model =
    { currentPage : Maybe Page
    , selections : List Selection
    , presentElements : Dict.Dict String (List Element)
    , localStore : LocalStore.Model
    , inspectedElement : Maybe String
    , pageReady : Bool
    , entity : Maybe Entity
    , actionType : ActionType
    , subject : String
    , flow : List ( ActionType, String )
    , panelVisible : Bool
    , activeSelector : String
    , activeSelectionId : Maybe String
    , activeAttachmentId : Maybe String
    , isCollection : Bool
    , selectionFilter : SelectionFilter
    , scopedLookup : Maybe String
    }


type Msg
    = CurrentPage ( Maybe Page, List (String, List Element) )
    | Highlight ( Maybe String, Int )
    | PickedElements PickingResult
    | JustElements (List Element)
    | Inspect ( String, Int )
    | VisibilityChange Bool
    | SetActive ( Maybe String )
    | SetSelectionFilter String
    | ConfigureFilterParam String
    | SetDataExtraction Bool
    | ChangeDataExtractorSource String
    | SetLookupMode (Maybe String)
    | RemoveSelection String
    | RemoveAttachment String String
    | SetActiveAttachment (Maybe String, Maybe String)
    | SaveHtml
    | AnalysePage


main : Program Never Model Msg
main =
    program
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- PORTS

port analysePage : String -> Cmd msg

port removeSelection : String -> Cmd msg


port removeAttachment : (String, String) -> Cmd msg


port lookupWithinScope : (Maybe String, Int ) -> Cmd msg


port pageReady : (Maybe String -> msg) -> Sub msg


port currentPage : (( Maybe Models.Page, List (String, List Element) ) -> msg) -> Sub msg


port highlight : ( Maybe String, Int ) -> Cmd msg


port createSelection : ( String, String, String, String ) -> Cmd msg


port updateSelection : ( String, String, String ) -> Cmd msg


port updateAttachment : ( String, String, String, String, Int ) -> Cmd msg


port createAttachment : ( String, String, String, String, Int ) -> Cmd msg


port inspect : ( Maybe String, Int ) -> Cmd msg


port scopedInspect : ( Maybe String, Int, String, Int ) -> Cmd msg


port resetSelection : Bool -> Cmd msg


port getCurrentPage : String -> Cmd msg


port pickedElements : (PickingResult -> msg) -> Sub msg


port justElements : (List Element -> msg) -> Sub msg


port queryElements : Selector -> Cmd msg


port visibilityChanges : (Bool -> msg) -> Sub msg


port saveHtml : String -> Cmd msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ pickedElements PickedElements
        , justElements JustElements
        , visibilityChanges VisibilityChange
        , currentPage CurrentPage
        ]


init : ( Model, Cmd Msg )
init =
    Model
        -- current page
        Nothing
        -- selections
        []
        -- presentElements
        Dict.empty
        LocalStore.init
        Nothing
        False
        Nothing
        EnterText
        -- actionType
        ""
        []
        False
        ""
        -- activeSelectionId
        Nothing
        -- activeAttachmentId
        Nothing
        False
        ( "no filter", "", "" )
        (Just "")
        ! [ analysePage "" ]


-- getSelection : Model -> Maybe Selector
-- getSelection model =
    -- LocalStore.getSelection model.localStore model.activeSelector


-- refreshSelectionResult : Model -> Cmd msg
-- refreshSelectionResult model =
    -- case getSelection model of
        -- Just selection ->
            -- queryElements <| Debug.log "query selection" selection
--
        -- Nothing ->
            -- Cmd.none

getSelector : Maybe String -> Maybe Page -> Maybe String
getSelector id page =
    case page of
        Just p ->
            p.selections
                |> List.filter (\s -> Just s.id == id)
                |> List.head
                |> Maybe.andThen (\s -> Just s.cssSelector)

        Nothing ->
            Nothing

getAttachment : Maybe String -> String -> Maybe Page -> (String, Int)
getAttachment selectionId attachmentId page =
    case page of
        Just p ->
            p.selections
                |> List.filter (\s -> Just s.id == selectionId)
                |> List.head
                |> Maybe.andThen (\s -> s.attachments
                    |> List.filter (\sa -> sa.id == attachmentId)
                    |> List.head
                )
                |> Maybe.andThen (\sa ->
                    Just (sa.cssSelector, sa.parentOffset)
                )
                |> Maybe.withDefault ("", 0)

        Nothing ->
            ("", 0)

update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        SaveHtml ->
            model ! [ saveHtml "" ]

        AnalysePage ->
            model ! [ analysePage "" ]

        RemoveAttachment selId attId ->
            model ! [ removeAttachment (selId, attId) ]

        RemoveSelection id ->
            model ! [ removeSelection id ]

        CurrentPage ( page, elements ) ->
            { model
                | currentPage = page
                , presentElements = Dict.fromList elements
                , selections =
                    case page of
                        Just p ->
                            p.selections

                        Nothing ->
                            []
            }
                ! []

        SetLookupMode mode ->
            { model | scopedLookup = mode } !
                [ lookupWithinScope ( getSelector mode model.currentPage, 0 )
                ]

        ChangeDataExtractorSource s ->
            case model.entity of
                Just e ->
                    let
                        newEntity =
                            { e | dataExtractor = Just <| { source = s } }
                    in
                        { model | entity = Just newEntity } ! [ ]--refreshSelectionResult model ]

                Nothing ->
                    model ! []

        SetDataExtraction s ->
            case model.entity of
                Just e ->
                    let
                        newEntity =
                            if s then
                                { e | dataExtractor = Just <| { source = "innerText" } }
                            else
                                { e | dataExtractor = Nothing }
                    in
                        { model | entity = Just newEntity } ! [ ] --refreshSelectionResult model ]

                Nothing ->
                    model ! []

        ConfigureFilterParam s ->
            let
                ( f, _, x ) =
                    model.selectionFilter
            in
                { model | selectionFilter = ( f, s, x ) } ! []

        SetSelectionFilter f ->
            { model | selectionFilter = ( f, "", "" ) } ! []


        SetActiveAttachment (selectionId, attachmentId) ->
            let
                updatedModel =
                    { model | activeSelectionId = selectionId, activeAttachmentId = attachmentId, scopedLookup = Just "" }

                selector =
                    getSelector selectionId model.currentPage

                ( attachmentSelector, parentOffset ) =
                    case attachmentId of
                        Just id ->
                            getAttachment selectionId id model.currentPage

                        Nothing ->
                            ( "", 0)
            in
                if selectionId == Nothing then
                    updatedModel ! [ highlight ( Nothing, 0 ) ]
                else
                    updatedModel !
                        --[ highlight ( selectionId, 0 ) ] --, refreshSelectionResult updatedModel ]
                        [ scopedInspect ( selector, 0, attachmentSelector, parentOffset ) ]

        SetActive selectionId ->
            let
                updatedModel =
                    { model | activeSelectionId = selectionId, activeAttachmentId = Nothing, scopedLookup = Just "" }
            in
                if selectionId == Nothing then
                    updatedModel ! [ highlight ( Nothing, 0 ) ]
                else
                    updatedModel !
                        --[ highlight ( selectionId, 0 ) ] --, refreshSelectionResult updatedModel ]
                        [ inspect ( getSelector selectionId model.currentPage, 0 ) ]

        VisibilityChange vis ->
            { model | panelVisible = vis }
                ! [ if model.currentPage /= Nothing then
                        getCurrentPage ""
                    else
                        Cmd.none
                  ]

        JustElements elements ->
            case model.entity of
                Just e ->
                    { model | entity = Just <| { e | pickedElements = elements } } ! []

                Nothing ->
                    model ! []

        PickedElements { id, primaryPick, elements, selector, parentOffset } ->
            let
                name =
                    elements
                        |> List.head
                        |> Maybe.andThen (\el -> el.label)
                        |> Maybe.withDefault selector

                pageId =
                    model.currentPage
                        |> Maybe.andThen (\page -> Just page.id)
                        |> Maybe.withDefault ""

                updatedModel =
                    model
            in
                case model.scopedLookup of
                    Nothing ->
                        model ! []

                    Just "" ->
                        case model.activeSelectionId of
                            Nothing ->
                                model ! [ createSelection ( id, name, pageId, selector ) ]

                            Just selectionId ->
                                case model.activeAttachmentId of
                                    Just  attachmentId ->
                                        model ! [ updateAttachment ( selectionId, attachmentId, name, selector, parentOffset ) ]

                                    Nothing ->
                                        model ! [ updateSelection ( selectionId, name, selector ) ]

                    Just selectionId ->
                        model ! [ createAttachment (selectionId, id, name, selector, parentOffset ) ]

        Highlight ( selector, index ) ->
            case selector of
                Nothing ->
                    { model | inspectedElement = Nothing }
                        ! [ model.entity
                                |> Maybe.andThen (\s -> Just ( Just s.selector, s.primaryPick ))
                                |> Maybe.withDefault ( Nothing, 0 )
                                |> highlight
                          ]

                Just _ ->
                    { model | inspectedElement = selector } ! [ highlight ( selector, index ) ]

        Inspect ( selector, index ) ->
            { model | panelVisible = False } ! [ inspect ( Just selector, index ) ]

icon : String -> Html.Html msg
icon cl =
    Html.i [ Attributes.class <| "fa fa-" ++ cl ] []


btnStyle : String -> Html.Attribute msg
btnStyle c =
    style
        [ ("font-weight", "bold")
        , ("font-family", "menlo")
        , ("color", c)
        , ("background", "#fff" )
        , ("border", "3px solid #777")
        , ("border-radius", "2px")
        , ("padding", "3px")
        , ("padding-left", "4px")
        , ("padding-right", "4px")
        ]

stopit : String -> msg -> Html.Html msg
stopit color clicked =
    Html.button
        [ Events.onClick clicked
        , btnStyle color
        ]
        [ Html.img [ Attributes.src "assets/stopit.png", Attributes.width 20 ] []
        , text " stop it"
        ]

icoBtn : String -> String -> msg -> Html.Html msg
icoBtn color ico clicked =
    Html.button
        [ btnStyle color
        , onClick clicked
        ]
        [ icon ico ]

view : Model -> Html.Html Msg
view model =
    case model.currentPage of
        Just page ->
            div [ style [ ( "display", "flex" ), ( "flex-direction", "column" ) ] ]
                --[ Html.div [] [ icon "paragraph", text <| " " ++ page.name ]
                [ model.selections
                    |> List.map (\s ->
                        let
                            isPresent id = Dict.member id model.presentElements

                            size id =
                                case Dict.get id model.presentElements of
                                    Just list ->
                                        List.length list

                                    Nothing -> 0

                            selectionIcon id =
                                span [ style
                                    [ ("border", "1px solid #000")
                                    , ("display", "inline-block")
                                    , ("width", "20px")
                                    , ("height", "20px")
                                    , ("text-align", "center")
                                    , ("background", "#111")
                                    ]] [
                                        if size id == 0 then
                                            text "∅"
                                        else if size id > 1 then
                                            icon "angle-double-right"
                                        else
                                            icon "angle-right"
                                    ]
                        in
                            Html.li [ style [("padding", "5px")], Attributes.class "selection" ]
                                [ selectionIcon s.id
                                , text " "
                                , span [ Attributes.class "text-label" ] [ text s.name ]
                                , text " "
                                , if model.scopedLookup == (Just s.id) then
                                span [ style [ ("color", "orange" ), ("font-family", "menlo") ] ]
                                    [ icon "paperclip"
                                    , text " attaching "
                                    , stopit "red" <| SetLookupMode Nothing
                                    ]
                                else if isPresent s.id then
                                    icoBtn "orange" "paperclip" <| SetLookupMode (Just s.id)
                                else
                                    text ""
                                , text " "
                                , if model.activeSelectionId == (Just s.id) && model.activeAttachmentId == Nothing then
                                    span [ style [ ("color", "orange" ), ("font-family", "menlo") ] ]
                                        [ text " adjusting css selector "
                                        , stopit "green" <| SetActive Nothing
                                        ]
                                  else
                                    icoBtn "royalblue" "wrench" <| SetActive (Just s.id)
                                , text " "
                                , icoBtn "red" "trash" <| RemoveSelection s.id
                                , if model.activeSelectionId == (Just s.id) then
                                    div [] [ text <| "×" ++ (toString <| size s.id) ]
                                  else
                                    text ""
                                , if List.isEmpty s.attachments then
                                    text ""
                                  else
                                    s.attachments
                                        |> List.map (\sa -> Html.li [ Attributes.class "attachment" ]
                                            [ selectionIcon sa.id
                                            , text " "
                                            , span [ Attributes.class "text-label" ] [ text sa.cssSelector ]
                                            , text " "
                                            , if model.activeAttachmentId == (Just sa.id) then
                                                span [ style [ ("color", "yellow" ), ("font-family", "menlo") ] ]
                                                    [ text " adjusting css selector "
                                                    , stopit "red"
                                                        <| SetActiveAttachment (Nothing, Nothing)
                                                    ]
                                              else
                                                icoBtn "royalblue" "wrench"
                                                    <| SetActiveAttachment (Just s.id, Just sa.id)
                                            , text " "
                                            , icoBtn "green" "trash" <| RemoveAttachment s.id sa.id
                                            , if model.activeAttachmentId == (Just sa.id) then
                                                div [] [ text <| "×" ++ (toString <| size sa.id) ]
                                              else
                                                text ""
                                            ])
                                        |> Html.ul [style [("padding-left", "20px") ]]
                                ]
                        )

                    |> Html.ul [style [("padding-left", "10px") ]]
                , div [ style [("padding", "5px") ]]
                    [ if model.scopedLookup == Nothing then
                        Html.button
                            [ Events.onClick <| SetLookupMode (Just "")
                            , btnStyle "#444"
                            ]
                            [ icon "crosshairs", text " pick new element from the page "
                            ]
                    else
                        case model.scopedLookup of
                            Just "" ->
                                div [ style [ ("color", "orange" ), ("font-family", "menlo") ] ]
                                    [ icon "crosshairs"
                                    , text " lookup is active "
                                    , stopit "red" <| SetLookupMode Nothing
                                    ]

                            _ ->
                                text ""

                    ]
                , div [] [ Html.button [ onClick SaveHtml ] [ text "Save html" ] ]
                , div [] [ Html.button [ onClick AnalysePage ] [ text "Analyse page" ] ]
                ]

        Nothing ->
            div [ style [ ( "text-align", "center" ), ( "width", "100%" ), ( "padding-top", "20vh" ), ( "display", "inline-block" ) ] ]
                [ Html.i [ style [ ("font-size", "14px" ) ], Attributes.class "fa fa-spinner fa-pulse fa-3x fa-fw" ] []
                , Html.br [] []
                , text " Waiting for a page to come back online…"
                ]



{-
   viewFlow : Model -> Html.Html Msg
   viewFlow model =
       let
           actionTypes =
               [ EnterText, Click ]

           verb =
               case model.actionType of
                   EnterText ->
                       "into"

                   Click ->
                       "on"

           subjects =
               model.localStore.selectors

              case model.actionType of
                  EnterText ->
                      model.localStore.selectors
                          |> Dict.values
                          |> List.filter (\s -> String.startsWith "INPUT" s.selector)

                  Click ->
                      model.localStore.selectors
                          |> Dict.values
                          |> List.filter (\s -> String.startsWith "INPUT" s.selector |> not)
           form =
               Html.form [ Events.onSubmit AddFlowAtom ]
                   --[ Html.button [] [ text "Add an action" ]
                   [ actionTypes
                       |> List.map (\at -> Html.option [ Attributes.selected (model.actionType == at) ] [ text <| toString at ])
                       |> Html.select [ Events.onInput SelectActionType ]
                   , text <| " " ++ verb ++ " "
                   , subjects
                       |> List.map
                           (\rec ->
                               Html.option [ Attributes.value rec.entity.selector, Attributes.selected (model.subject == rec.entity.selector) ]
                                   [ text <|
                                       if rec.name == "" then
                                           rec.entity.selector
                                       else
                                           rec.name
                                   ]
                           )
                       |> Html.select [ Events.onInput SelectSubject ]
                   , Html.button [] [ text "Yes, yes, this is my design!" ]
                   ]
       in
           div []
               [ model.flow
                   |> List.map (\( actionType, sel ) -> div [] [ text <| (toString actionType) ++ ": " ++ sel ])
                   |> div []
               , form
               ]
-}


viewSelectors : Model -> Html.Html Msg
viewSelectors model =
    let
        selectors =
            case LocalStore.selectedContext model.localStore of
                Just ctx ->
                    ctx.selectors

                Nothing ->
                    model.localStore.selectors
    in
        selectors
            |> List.map
                (\s ->
                    let
                        --isHighlighted =
                        --s.entity.selector == (Maybe.withDefault "" model.inspectedElement)
                        isActive =
                            s.entity.selector == model.activeSelector

                        hasChildren =
                            s.entity.pickedElements
                                |> List.head
                                |> (\s ->
                                        case s of
                                            Just el ->
                                                el.hasChildren

                                            Nothing ->
                                                False
                                   )
                    in
                        Html.li
                            [ -- Events.onMouseEnter <| Highlight (Just s.selector, 0)
                              --, Events.onMouseLeave <| Highlight (Just model.activeSelector, 0)
                              style
                                [ ( "padding", "5px" )
                                , ( "margin", "5px" )
                                , ( "vertical-align", "middle" )
                                  -- , ( "background", "#000" )
                                , ( "max-width", "200px" )
                                , ( "border-bottom"
                                  , if isActive then
                                        "1px solid #777"
                                    else
                                        "1px solid #444"
                                  )
                                  --, -- , if isHighlighted then
                                  -- "1px solid white"
                                  -- else
                                ]
                            ]
                            [ Html.code
                                [ style <|
                                    (( "font-size", "12px" ))
                                        :: (if isActive then
                                                [ ( "color", "red" ) ]
                                            else
                                                []
                                           )
                                ]
                                [ text <|
                                    if s.isCollection then
                                        "⇶ "
                                    else
                                        "→ "
                                ]
                            ]
                )
            |> Html.ul
                [ style
                    [ ( "list-style", "none" )
                    , ( "padding", "0" )
                    ]
                ]
