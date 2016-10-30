port module Main exposing (..)

import Html exposing (div, span, text)
import Html.App exposing (program)
import Html.Attributes exposing (..)
import Html.Events exposing (onClick)
import Dict
import Mouse
import Keyboard
import Window
import Task
import PageVisibility
import Fragments.SelectorTooltip exposing (selectorTooltip)


--import Html.Events exposing (onClick, onInput)


main : Program Never
main =
    program
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }



-- MODEL


type alias Model =
    { mouse : Mouse.Position
    , elementUnderCursor : Maybe Element
    , pickedElements : List Element
    , primaryPick : Int
    , lookupActive : Bool
    , windowSize : Window.Size
    , rejects : Rejects
    , selector : String
    }


type alias Rejects =
    Dict.Dict Int Element


type alias Element =
    { x : Int
    , y : Int
    , distanceToTop : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    , elementId : Int
    }


type alias PickingResult =
    { selector : String
    , elements : List Element
    }


type alias InlineStyle =
    List ( String, String )


init : ( Model, Cmd Msg )
init =
    (Model
        { x = 0, y = 0 }
        Nothing
        []
        0
        False
        { width = 800, height = 600 }
        Dict.empty
        ""
    )
        ! [ Task.perform (\_ -> NoOp) (\size -> WindowResize size) Window.size ]



-- UPDATE


type Msg
    = NoOp
    | MouseMove Mouse.Position
    | ActiveElement (Maybe Element)
    | KeyDown Keyboard.KeyCode
    | KeyUp Keyboard.KeyCode
    | WindowResize Window.Size
    | PickElement
    | PickedElements PickingResult
    | ToggleReject Element
    | QueryPage
    | Reset
    | VisibilityChange PageVisibility.Visibility


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    let
        lookupActivationKey =
            18

        lookup state =
            { model | lookupActive = state, elementUnderCursor = Nothing }
    in
        case msg of
            NoOp ->
                model ! []

            MouseMove pos ->
                { model | mouse = pos } ! [ boundingRectAtPosition pos ]

            ActiveElement rect ->
                { model | elementUnderCursor = rect } ! []

            Reset ->
                { model
                    | primaryPick = 0
                    , rejects = Dict.empty
                    , pickedElements = []
                    , selector = ""
                }
                    ! []

            PickElement ->
                case model.elementUnderCursor of
                    Nothing ->
                        model ! []

                    Just el ->
                        update QueryPage
                            { model
                                | elementUnderCursor = Nothing
                                , primaryPick = el.elementId
                                , rejects = Dict.empty
                            }

            QueryPage ->
                model
                    ! [ pickElement
                            { elementId = model.primaryPick
                            , rejects = Dict.keys model.rejects
                            }
                      ]

            ToggleReject element ->
                update QueryPage { model | rejects = toggle model.rejects element }

            PickedElements { selector, elements } ->
                { model | pickedElements = elements, selector = selector } ! []

            WindowResize size ->
                { model | windowSize = size } ! []

            KeyDown code ->
                if code == lookupActivationKey then
                    lookup True ! [ getMousePosition 1 ]
                else
                    model ! []

            KeyUp code ->
                if code == lookupActivationKey then
                    lookup False ! []
                else
                    model ! []

            VisibilityChange vis ->
                { model | lookupActive = Debug.log "change visi" False } ! []


toggle : Rejects -> Element -> Rejects
toggle dict element =
    if Dict.member element.elementId dict then
        Dict.remove element.elementId dict
    else
        Dict.insert element.elementId element dict



-- PORTS


port boundingRectAtPosition : Mouse.Position -> Cmd msg


port activeElement : (Maybe Element -> msg) -> Sub msg


port pickElement : { elementId : Int, rejects : List Int } -> Cmd msg


port pickedElements : (PickingResult -> msg) -> Sub msg


port getMousePosition : Int -> Cmd msg


port mousePosition : (Mouse.Position -> msg) -> Sub msg



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ if model.lookupActive then
            Mouse.moves MouseMove
          else
            Sub.none
        , Keyboard.ups KeyUp
        , Keyboard.downs KeyDown
        , Window.resizes WindowResize
        , activeElement ActiveElement
        , pickedElements PickedElements
        , mousePosition MouseMove
        , PageVisibility.visibilityChanges VisibilityChange
        ]



-- VIEW


view : Model -> Html.Html Msg
view model =
    let
        active =
            case model.elementUnderCursor of
                Just el ->
                    if el.elementId /= model.primaryPick then
                        renderBox el
                            [ selectorTooltip el model.windowSize.height ]
                            PickElement
                            elementUnderCursorStyle
                    else
                        text ""

                Nothing ->
                    text ""

        picked =
            model.pickedElements
                |> List.map
                    (\el ->
                        renderBox el
                            []
                            (if el.elementId == model.primaryPick then
                                Reset
                             else
                                ToggleReject el
                            )
                            (if el.elementId == model.primaryPick then
                                primaryPickStyle
                             else
                                pickedElementStyle
                            )
                    )

        rejected =
            model.rejects
                |> Dict.values
                |> List.map (\el -> renderBox el [] (ToggleReject el) rejectedElementStyle)
    in
        div []
            [ active
            , div [] picked
            , div [] rejected
            , div
                [ style
                    [ ( "position", "fixed" )
                    , ( "bottom", "0" )
                    , ( "left", "0" )
                    , ( "padding", "10px" )
                    , ( "background", "white" )
                    , ( "color", "black" )
                    , ( "font-family", "menlo, monospaced" )
                    , ( "font-size", "16px" )
                    ]
                ]
                [ text model.selector
                , div
                    [ style
                        [ ( "font-size", "10px" )
                        , ( "color", "grey" )
                        ]
                    ]
                    [ text ((toString (List.length model.pickedElements)) ++ " elem.") ]
                ]
            ]


renderBox : Element -> List (Html.Html Msg) -> Msg -> InlineStyle -> Html.Html Msg
renderBox el nodes click inlineStyle =
    let
        { x, y, width, height } =
            el

        px n =
            (toString n) ++ "px"
    in
        div
            [ style
                ([ ( "position", "absolute" )
                 , ( "z-index", "100000" )
                 , ( "top", px y )
                 , ( "left", px x )
                 , ( "width", px width )
                 , ( "height", px height )
                 ]
                    ++ inlineStyle
                )
            , onClick click
            ]
            nodes


pickedElementStyle : InlineStyle
pickedElementStyle =
    [ ( "background", "rgba(30, 130, 30, 0.1)" )
    , ( "box-shadow", "0 0 0 2px rgba(30, 130, 30, 0.1618)" )
    , ( "border-radius", "0px" )
    , ( "z-index", "1" )
    , ( "cursor", "-webkit-grabbing" )
    ]


primaryPickStyle : InlineStyle
primaryPickStyle =
    [ ( "background", "rgba(30, 30, 230, 0.1)" )
    , ( "box-shadow", "0 0 0 5px rgba(30, 30, 230, 0.1618)" )
    , ( "border-radius", "0px" )
    , ( "z-index", "1" )
    , ( "cursor", "-webkit-grabbing" )
    ]


rejectedElementStyle : InlineStyle
rejectedElementStyle =
    [ ( "background", "none" )
    , ( "box-shadow", "0 0 0 2px rgba(130, 30, 30, 0.1618)" )
    , ( "border-radius", "0px" )
    , ( "z-index", "1" )
    , ( "cursor", "-webkit-grab" )
    ]


elementUnderCursorStyle : InlineStyle
elementUnderCursorStyle =
    [ ( "background", "rgba(130, 240, 90, 0.1)" )
    , ( "box-shadow", "0 0 0 5px rgba(30, 40, 190, 0.1)" )
    , ( "border-radius", "0px" )
    , ( "z-index", "2" )
    , ( "cursor", "-webkit-grab" )
    ]
