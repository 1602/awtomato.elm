port module Sidebar exposing (..)

import Html exposing (program)
import Html exposing (div, span, text)
-- import Html.Events as Events exposing (onClick)
-- import Html.Attributes as Attributes exposing (style)
import Dict
import Fragments.Entity exposing (viewEntity)
import Models exposing (..)


type ActionType = EnterText | Click


type alias PickingResult =
    { selector : String
    , elements : List Element
    }


type alias LocalStore =
    { selectors : Dict.Dict String Selector
    }


type alias RawLocalStore =
    { selectors : List Selector
    }


type alias Selector =
    { selector : String
    , name : String
    }


type alias Model =
    { localStore : LocalStore
    , inspectedElement : Maybe String
    , pageReady : Bool
    , entity : Maybe Entity
    , actionType : ActionType
    , subject : String
    , flow : List (ActionType, String)
    , panelVisible : Bool
    }


type Msg
    = StoreUpdated RawLocalStore
    | PageReady (Maybe String)
    | Highlight (Maybe String, Int)
    | PickedElements PickingResult
    | Inspect ( String, Int )
    | VisibilityChange Bool


main : Program Never Model Msg
main =
    program
        { init = init
        , view = view
        , update = update
        , subscriptions = subscriptions
        }


port pageReady : (Maybe String -> msg) -> Sub msg


port highlight : (Maybe String, Int) -> Cmd msg


port inspect : ( String, Int ) -> Cmd msg


port resetSelection : Bool -> Cmd msg


port loadData : String -> Cmd msg


port storeUpdated : (RawLocalStore -> msg) -> Sub msg


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
        (LocalStore Dict.empty)
        Nothing
        False
        Nothing
        EnterText -- actionType
        ""
        []
        False
        ! []


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        VisibilityChange vis ->
            { model | panelVisible = Debug.log "panel visibility" vis } ! []

        PickedElements { selector, elements } ->
            let
                updatedModel =
                    { model
                        | entity = Just (Entity 0 elements selector)
                    }
            in
                updatedModel ! []


        StoreUpdated rawLocalStore ->
            { model
                | localStore =
                    { selectors =
                        rawLocalStore.selectors
                            |> List.map (\s -> ( s.selector, s ))
                            |> Dict.fromList
                    }
            }
                ! []

        PageReady url ->
            { model | pageReady = url /= Nothing }
                ! [ case url of
                        Just s ->
                            loadData s

                        Nothing ->
                            Cmd.none
                  ]

        Highlight (selector, index) ->
            { model | inspectedElement = selector } ! [ highlight ( selector, index ) ]

        Inspect ( selector, index ) ->
            { model | panelVisible = False } ! [ inspect ( selector, index ) ]


view : Model -> Html.Html Msg
view model =
    if model.pageReady then
        div []
            [ case model.entity of
                Just e ->
                    viewEntity e Inspect Highlight

                Nothing ->
                    text ""
            ]
    else
        text "Waiting for a page to come back online..."

