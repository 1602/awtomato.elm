port module Panel exposing (..)

import Html exposing (program)
import Html exposing (div, span, text)
import Html.Events as Events exposing (onClick)
import Html.Attributes as Attributes exposing (style)
import Models exposing (..)
import Fragments.Entity exposing (viewEntity)
import LocalStore


type ActionType
    = EnterText
    | Click


type alias PickingResult =
    { primaryPick : Int
    , elements : List Element
    , selector : String
    }


type alias Model =
    { localStore : LocalStore.Model
    , url : String
    , inspectedElement : Maybe String
    , pageReady : Bool
    , entity : Maybe Entity
    , actionType : ActionType
    , subject : String
    , flow : List ( ActionType, String )
    , panelVisible : Bool
    , activeSelector : String
    , isCollection : Bool
    , selectionFilter : SelectionFilter
    }


type Msg
    = StoreUpdated LocalStore.Model
    | LocalStoreMsg LocalStore.Msg
    | PageReady (Maybe String)
    | Highlight ( Maybe String, Int )
    | PickedElements PickingResult
    | Inspect ( String, Int )
    | VisibilityChange Bool
    | SetActive Entity
    | SetIsCollection Bool
    | SetSelectionFilter String


main : Program Never Model Msg
main =
    program
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- PORTS


port pageReady : (Maybe String -> msg) -> Sub msg


port highlight : ( Maybe String, Int ) -> Cmd msg


port inspect : ( String, Int ) -> Cmd msg


port resetSelection : Bool -> Cmd msg


port loadData : String -> Cmd msg


port updateStore : LocalStore.Model -> Cmd msg


port storeUpdated : (LocalStore.Model -> msg) -> Sub msg


port pickedElements : (PickingResult -> msg) -> Sub msg


port visibilityChanges : (Bool -> msg) -> Sub msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ pageReady PageReady
        , storeUpdated StoreUpdated
        , pickedElements PickedElements
        , visibilityChanges VisibilityChange
        ]


init : ( Model, Cmd Msg )
init =
    Model
        (LocalStore.Model [] "" [] "" "")
        ""
        -- url
        Nothing
        False
        Nothing
        EnterText
        -- actionType
        ""
        []
        False
        ""
        False
        ("no filter", "", "")
        ! []


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        SetSelectionFilter f ->
            { model | selectionFilter = (f, "", "") } ! []

        SetIsCollection v ->
            let
                updatedModel =
                    { model | isCollection = v }
            in
                case model.entity of
                    Just e ->
                        update (LocalStoreMsg <| LocalStore.SaveSelection e True ("no filter", "", "")) updatedModel

                    Nothing ->
                        updatedModel ! []

        LocalStoreMsg msg ->
            let
                ( updatedLocalStore, cmd ) =
                    LocalStore.update msg model.localStore
            in
                { model | localStore = updatedLocalStore } ! [ updateStore updatedLocalStore ]

        SetActive e ->
            if e.selector == model.activeSelector then
                { model | activeSelector = "", entity = Nothing } ! [ highlight ( Nothing, 0 ) ]
            else
                { model | activeSelector = e.selector, entity = Just e } ! [ highlight ( Just e.selector, 0 ) ]

        VisibilityChange vis ->
            { model | panelVisible = vis }
                ! [ if model.url /= "" then
                        loadData model.url
                    else
                        Cmd.none
                  ]

        PickedElements { primaryPick, elements, selector } ->
            let
                e =
                    Entity primaryPick elements selector

                updatedModel =
                    { model
                        | entity = Just e
                        , activeSelector = ""
                    }
            in
                if List.length elements == 1 then
                    update (LocalStoreMsg <| LocalStore.SaveSelection e False ("no filter", "", "")) updatedModel
                else
                    updatedModel ! []

        StoreUpdated localStore ->
            { model | localStore = localStore } ! []

        PageReady url ->
            { model | pageReady = url /= Nothing, url = Maybe.withDefault "" url }
                ! [ case url of
                        Just s ->
                            loadData s

                        Nothing ->
                            Cmd.none
                  ]

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
            { model | panelVisible = False } ! [ inspect ( selector, index ) ]


view : Model -> Html.Html Msg
view model =
    if model.pageReady then
        div [ style [ ( "display", "flex" ), ( "flex-direction", "column" ) ] ]
            [ div
                [ style [ ( "height", "50vh" ) ]
                ]
                [ Html.map LocalStoreMsg <| div
                    [ style
                        [ ( "height", "20px" )
                        , ( "border-bottom", "1px solid #555" )
                        , ( "display", "flex" )
                        ]
                    ]
                    [ LocalStore.selectContextView model.localStore
                    , Html.input
                        [ Attributes.value model.localStore.contextName
                        , Events.onInput LocalStore.ChangeContextName
                        , Attributes.placeholder "Enter context name, please"
                        , style
                            [ ( "background", "transparent" )
                            , ( "border", "0px solid #bcaaa4" )
                              --, ( "border-bottom", "1px solid #bcaaa4")
                            , ( "color", "#999" )
                            , ( "padding", "5px" )
                            , ( "margin", "0px" )
                            , ( "margin-left", "10px" )
                              --, ( "font-weight", "bold")
                            , ( "width", "100%" )
                            , ( "outline", "none" )
                            , ( "font-family", "menlo, monospace" )
                            , ( "font-size", "12px" )
                            ]
                        ]
                        []
                    ]
                , viewSelectors model
                , makeFlow model
                ]
            , div
                [ style
                    [ ( "height", "50vh" )
                    , ( "background", "black" )
                    , ( "box-sizing", "border-box" )
                    , ( "border-top", "1px solid rgb(36, 36, 36)" )
                    ]
                ]
                [ case model.entity of
                    Just e ->
                        let
                            (ff, _, _) = model.selectionFilter
                        in
                            div []
                                [ viewEntity e Inspect Highlight
                                , if List.length e.pickedElements > 1 then
                                    Html.label []
                                        [ Html.input
                                            [ Attributes.type_ "checkbox"
                                            , Attributes.checked model.isCollection
                                            , Events.onCheck SetIsCollection
                                            ]
                                            []
                                        , text "This is collection"
                                        ]
                                  else
                                    text ""
                                , if List.length e.pickedElements > 1 then
                                    Html.select
                                        [ Events.onInput SetSelectionFilter
                                        ]
                                        ([ "no filter", "innerText", "attribute", "expression" ]
                                        |> List.map (\f -> Html.option [ Attributes.selected <| ff == f ] [ text f ])
                                        )
                                  else
                                    text ""
                                , case ff of
                                    "innerText" ->
                                        Html.input [ Events.onInput ConfigureFilterParam1 ] []

                                    "attribute" ->
                                        span []
                                            [ Html.input [ Events.onInput ConfigureFilterParam1 ] []
                                            , Html.input [ Events.onInput ConfigureFilterParam2 ] []
                                            ]
                                    "expression" ->
                                        Html.input [ Events.onInput ConfigureFilterParam1 ] []
                                        
                                    _ ->
                                        text ""
                                  --, if model.isCollection then
                                  --  else
                                ]

                    Nothing ->
                        text ""
                ]
              -- , Html.span [ style [("font-size", "16px")] ] [ text model.activeSelector ]
              -- , text "2. Describe a flow..."
              -- , viewFlow model
            ]
    else
        div [ style [ ("text-align", "center"), ("width", "100%"), ("padding-top", "20vh"), ("display", "inline-block") ] ] [
            text "Waiting for a page to come back online…"
        ]


makeFlow : Model -> Html.Html Msg
makeFlow model =
    if List.isEmpty model.localStore.selectors then
        text ""
    else
        div [ style [ ( "padding", "5px" ) ] ]
            [ Html.map LocalStoreMsg <| Html.button [ onClick LocalStore.CommitContext ] [ text "Create new context" ]
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
                                [ Events.onClick <| SetActive s.entity
                                , style <|
                                    ( ("font-size", "12px") ) ::
                                    (if isActive then [ ] else [ ("filter", "grayscale(100)") ])
                                ] [ text <| if isActive then "🎯 " else "🎯 " ]
                            , Html.map LocalStoreMsg <| LocalStore.viewSelection s ]
                )
            |> Html.ul
                [ style
                    [ ( "list-style", "none" )
                    , ( "padding", "0" )
                    ]
                ]
