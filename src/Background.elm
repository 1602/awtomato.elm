port module Background exposing (..)

import Html exposing (program)
import Html exposing (div, span, text)
import Html.Events as Events exposing (onClick)
import Html.Attributes as Attributes exposing (style)
-- import Dict

type alias Model =
    { question : String
    , options : List String
    , answer : String
    }


type Msg
    = QuestionAsked (String, List String)
    | ChangeAnswer String
    | SubmitAnswer


main : Program Never Model Msg
main =
    program
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }


port question : ((String, List String) -> msg) -> Sub msg


port answer : String -> Cmd msg


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ question QuestionAsked
        ]


init : ( Model, Cmd Msg )
init =
    Model
        ""
        []
        ""
        ! []


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ChangeAnswer v ->
            { model | answer = v } ! []

        SubmitAnswer ->
            { model | question = "", options = [], answer = "" } ! [ answer model.answer ]

        QuestionAsked (q, op) ->
            { model | question = q, options = op } ! []


view : Model -> Html.Html Msg
view model =
    let
        viewOption o =
            Html.option
                [ Attributes.value o
                , Attributes.selected <| o == model.answer
                ]
                [ text o
                ]

        selectFromOptions opts =
            opts
                |> List.map viewOption
                |> (::) (Html.option [ Attributes.value "" ] [ text "Select something" ])
                |> Html.select [ Events.onInput ChangeAnswer ]
    in
        if model.question /= "" then
            Html.form [ Events.onSubmit SubmitAnswer ]
                [ Html.label [] [ text model.question ]
                , if List.isEmpty model.options then
                    Html.input [ Events.onInput ChangeAnswer ] []
                  else
                    selectFromOptions model.options
                , Html.button [] [ text "Submit" ]
                ]
        else 
            text "Nothing to see here..."

