port module Main exposing (..)

import Html exposing (div, span, text)
import Html.App exposing (program)
import Html.Attributes exposing (..)
import Mouse
import Keyboard
import Window
import Task
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
    , lookupActive : Bool
    , windowSize : Window.Size
    }


type alias Element =
    { x : Int
    , y : Int
    , distanceToTop : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    }


type alias InlineStyle =
    List ( String, String )


init : ( Model, Cmd Msg )
init =
    (Model
        { x = 0, y = 0 }
        Nothing
        False
        { width = 800, height = 600 }
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


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    let
        metaKey =
            91

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

            WindowResize size ->
                { model | windowSize = size } ! []

            KeyDown code ->
                if code == metaKey then
                    lookup True ! []
                else
                    model ! []

            KeyUp code ->
                if code == metaKey then
                    lookup False ! []
                else
                    model ! []


port boundingRectAtPosition : Mouse.Position -> Cmd msg


port activeElement : (Maybe Element -> msg) -> Sub msg



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ if model.lookupActive then
            Mouse.moves MouseMove
          else
            Sub.none
        , activeElement ActiveElement
        , Keyboard.ups KeyUp
        , Keyboard.downs KeyDown
        , Window.resizes WindowResize
        ]



-- VIEW


view : Model -> Html.Html Msg
view model =
    case model.elementUnderCursor of
        Just el ->
            renderBox el
                [ selectorTooltip el model.windowSize.height ]
                [ ( "background", "rgba(130, 240, 90, 0.1)" )
                , ( "box-shadow", "0 0 0 5px rgba(30, 40, 190, 0.1)" )
                , ( "border-radius", "2px" )
                ]

        Nothing ->
            text ""


renderBox : Element -> List (Html.Html Msg) -> InlineStyle -> Html.Html Msg
renderBox el nodes inlineStyle =
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
            ]
            nodes
