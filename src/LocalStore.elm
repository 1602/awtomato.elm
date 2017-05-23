module LocalStore exposing (Model, Msg, Msg(SaveSelection, RemoveSelection, CommitContext, ChangeContextName), update, selectContextView, selectedContext, viewSelection)

import Models exposing (Selector, Context, Entity)
import Html exposing (text, div)
import Html.Events as Events
import Html.Attributes as Attributes exposing (style)


type alias Model =
    { selectors : List Selector
    , selectedContext : String
    , contexts : List Context
    , host : String
    , contextName : String
    }


type Msg
    = SaveSelection Entity Bool
    | RemoveSelection String
    | ChangeContextName String
    | ChangeSelectionName String String
    | CommitContext
    | SelectContext String


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        SelectContext s ->
            { model | selectedContext = s, contextName = "" } ! []



        CommitContext ->
            { model
                | contexts =
                    model.contexts ++ [ Context "" model.contextName model.selectors ]
            }
                ! []

        ChangeSelectionName selector newName ->
            let
                updateName selectors =
                    selectors
                        |> List.map (\s ->
                            if s.entity.selector == selector then
                                { s | name = newName }
                            else
                                s
                        )
            in
                { model
                    | contexts =
                        model.contexts
                            |> List.map (\ctx ->
                                if ctx.id == model.selectedContext then
                                    { ctx | selectors = updateName ctx.selectors }
                                else
                                    ctx
                            )
                } ! []

        ChangeContextName s ->
            if model.selectedContext == "" then
                { model | contextName = s } ! []
            else
                { model
                    | contextName = s
                    , contexts =
                        model.contexts
                            |> List.map
                                (\ctx ->
                                    if ctx.id == model.selectedContext then
                                        { ctx | name = s }
                                    else
                                        ctx
                                )
                }
                    ! []

        RemoveSelection selector ->
            let
                ctx =
                    selectedContext model

                selectors =
                    case ctx of
                        Just context ->
                            context.selectors

                        Nothing ->
                            model.selectors

                newSelectors =
                    List.filter (\s -> s.entity.selector /= selector) selectors

                updatedLocalStore =
                    case ctx of
                        Nothing ->
                            { model
                                | selectors = newSelectors
                            }

                        Just context ->
                            { model
                                | contexts =
                                    model.contexts
                                        |> List.map
                                            (\c ->
                                                if c.id == context.id then
                                                    { c | selectors = newSelectors }
                                                else
                                                    c
                                            )
                            }
            in
                updatedLocalStore ! [{- highlight ( Nothing, 0 ), -}]

        SaveSelection e isCollection ->
            let
                ctx =
                    selectedContext model

                selectors =
                    case ctx of
                        Just context ->
                            context.selectors

                        Nothing ->
                            model.selectors

                name =
                    e.pickedElements
                        |> List.head
                        |> (\s ->
                                case s of
                                    Nothing ->
                                        ""

                                    Just el ->
                                        Maybe.withDefault "" el.label
                           )

                updatedSelectors =
                    if List.map (\s -> s.entity.selector) selectors |> List.member e.selector then
                        selectors
                    else
                        selectors ++ [ Selector name e isCollection ]

                updatedLocalStore =
                    case ctx of
                        Just context ->
                            { model
                                | contexts =
                                    model.contexts
                                        |> List.map
                                            (\c ->
                                                if c.id == context.id then
                                                    { c | selectors = updatedSelectors }
                                                else
                                                    c
                                            )
                            }

                        Nothing ->
                            { model | selectors = updatedSelectors }
            in
                -- TODO: move activeSelector to an upper level module
                updatedLocalStore ! [{- highlight ( Just selector, 0 ), -}]



--, entity = Nothing
--, activeSelector = selector


selectedContext : Model -> Maybe Context
selectedContext model =
    model.contexts
        |> List.filter (\a -> a.id == model.selectedContext)
        |> List.head


selectContextView : Model -> Html.Html Msg
selectContextView model =
    Html.select
        [ style
            [ ( "border", "0" )
            , ( "border-radius", "0" )
            , ( "background-color", "transparent" )
            , ( "font-size", "14px" )
            , ( "color", "#999" )
            ]
        , Events.onInput SelectContext
        ]
        ([ Html.option [ Attributes.value "" ] [ text model.host ] ]
            ++ (model.contexts
                    |> List.map
                        (\c ->
                            Html.option [ Attributes.selected <| c.id == model.selectedContext, Attributes.value c.id ] [ text c.name ]
                        )
               )
        )


viewSelection : Selector -> Html.Html Msg
viewSelection s =
    div []
        [ Html.input
            [ style
                [ ( "font-size", "12px" )
                , ( "font-family", "menlo, monospace" )
                , ( "background", "#000" )
                , ( "color", "#888" )
                , ( "border", "0" )
                , ( "outline", "none" )
                , ( "width", "calc(100% - 25px)" )
                , ( "text-overflow", "ellipsis" )
                ]
            , Attributes.value s.name
            , Events.onInput <| ChangeSelectionName s.entity.selector
            ]
            []
          {-
             , s.entity.pickedElements
                 |> List.head
                 |> Maybe.andThen (\s -> Just (text <| toString s.hasChildren))
                 |> Maybe.withDefault (text "")
          -}
          {-
             , if isHighlighted then
                 Html.code [ style [ ( "color", "white" ) ] ] [ text s.selector ]
               else
                 Html.code [] [ text s.selector ]
          -}
          -- , Html.code [ Events.onClick <| Inspect ( s.entity.selector, 0 ) ] [ text " [i] " ]
        , Html.code
            [ style
                [ ( "cursor", "pointer" )
                , ( "display", "inline-block" )
                , ( "background", "#111" )
                , ( "color", "#b21" )
                  --, ( "font-weight", "700" )
                , ( "font-size", "18px" )
                , ( "font-family", "menlo, monospace" )
                , ( "width", "20px" )
                , ( "height", "20px" )
                , ( "line-height", "20px" )
                , ( "border", "1px solid #222" )
                , ( "text-align", "center" )
                ]
            , Events.onClick <| RemoveSelection s.entity.selector
            ]
            [ text " × " ]
        ]
