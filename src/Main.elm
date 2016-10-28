port module Main exposing (..)

import Html exposing (div, span, text)
import Html.App exposing (program)
import Html.Attributes exposing (..)
import Mouse
import Keyboard
import Json.Encode


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
    , meta : Bool
    }


type alias Element =
    { x : Int
    , y : Int
    , width : Int
    , height : Int
    , id : Maybe String
    , tagName : String
    , classList : List String
    }


init : ( Model, Cmd msg )
init =
    (Model
        { x = 0, y = 0 }
        Nothing
        False
    )
        ! []



-- UPDATE


type Msg
    = NoOp
    | MouseMove Mouse.Position
    | ActiveElement (Maybe Element)
    | KeyDown Keyboard.KeyCode
    | KeyUp Keyboard.KeyCode


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        NoOp ->
            model ! []

        MouseMove pos ->
            { model | mouse = pos } ! [ boundingRectAtPosition pos ]

        ActiveElement rect ->
            { model | elementUnderCursor = rect } ! []

        KeyDown code ->
            if code == 91 then
                { model | meta = True } ! []
            else
                model ! []

        KeyUp code ->
            if code == 91 then
                { model | meta = False, elementUnderCursor = Nothing } ! []
            else
                model ! []



{-
   Increment ->
     ({ model | count = model.count + 1 }, Cmd.none)

   Decrement ->
     ({ model | count = model.count - 1 }, Cmd.none)

   Tick ->
     ({ model | elapsed = model.elapsed + 1}, Cmd.none)

   Alert ->
     (model, alert model.alertText)

   ChangeAlertText text ->
     ({ model | alertText = text }, Cmd.none)

   Log text ->
     ({ model | logs = text :: model.logs }, Cmd.none)
-}


port boundingRectAtPosition : Mouse.Position -> Cmd msg


port activeElement : (Maybe Element -> msg) -> Sub msg



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ if model.meta then
            Mouse.moves MouseMove
          else
            Sub.none
        , activeElement ActiveElement
        , Keyboard.ups KeyUp
        , Keyboard.downs KeyDown
        ]



-- VIEW


view : Model -> Html.Html Msg
view model =
    renderBox model.elementUnderCursor


renderBox : Maybe Element -> Html.Html Msg
renderBox el =
    case el of
        Just el ->
            let
                { x, y, width, height } =
                    el
            in
                div
                    [ style
                        [ ( "position", "absolute" )
                        , ( "top", px y )
                        , ( "left", px x )
                        , ( "width", px width )
                        , ( "height", px height )
                        , ( "background", "rgba(30, 40, 190, 0.2)" )
                          -- , ( "border", "1px solid rgba(30, 40, 130, 0.5)" )
                        , ( "box-shadow", "0 0 0 1px rgba(30, 40, 190, 0.5)" )
                        , ( "border-radius", "2px" )
                        , ( "z-index", "100000" )
                        ]
                    ]
                    [ selector el ]

        Nothing ->
            text ""


selector : Element -> Html.Html msg
selector el =
    div
        [ style
            [ ( "position", "absolute" )
            , ( "top", "-20px" )
            , ( "left", "0" )
            , ( "height", "20px" )
            , ( "lineHeight", "20px" )
            , ( "textAlign", "center" )
            , ( "background", "rgba(255,100,100,0.8)" )
            , ( "color", "white" )
            , ( "fontWeight", "bold" )
            , ( "cursor", "pointer" )
            , ( "border-radius", "2px" )
            , ( "top", "-25px" )
            , ( "left", "0px" )
            , ( "whiteSpace", "nowrap" )
            , ( "paddingLeft", "6px" )
            , ( "background", "#333740" )
            , ( "paddingRight", "6px" )
            , ( "fontWeight", "normal" )
            , ( "fontFamily", "menlo, monospace" )
            , ( "fontSize", "10px" )
            , ( "color", "#D9D9D9" )
            ]
        ]
        ([ div
            [ style
                [ ( "width", "0" )
                , ( "height", "0" )
                , ( "position", "absolute" )
                , ( "left", "20px" )
                , ( "top", "20px" )
                , ( "border", "7px solid transparent" )
                , ( "border-top-color", "#333740" )
                ]
            ]
            []
         , span [ style [ ( "font-weight", "bold" ), ( "color", "#EE78E6" ) ] ]
            [ text el.tagName ]
         , case el.id of
            Just id ->
                coloredText "#FFAB66" ("#" ++ id)

            Nothing ->
                text ""
         ]
            ++ (el.classList
                    |> List.map ((++) ".")
                    |> List.map (coloredText "#8ED3FB")
               )
            ++ [ coloredText "#7F7F7F" " | "
               , span
                    [ property "innerHTML"
                        (Json.Encode.string
                            ((toString el.width) ++ "&times" ++ (toString el.height))
                        )
                    ]
                    []
               ]
        )


coloredText : String -> String -> Html.Html msg
coloredText color str =
    span [ style [ ( "color", color ) ] ] [ text str ]


px : Int -> String
px n =
    (toString n) ++ "px"
