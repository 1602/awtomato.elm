module Fragments.Entity exposing (viewEntity)
import Models exposing (..)
import Html exposing (div, span, text)
import Html.Attributes as Attributes exposing (style)
import Html.Events as Events exposing (onClick)

viewEntity : Entity -> ((String, Int) -> msg) -> ((Maybe String, Int) -> msg) -> Html.Html msg
viewEntity entity inspect highlight =
    let
        len =
            List.length entity.pickedElements
    in
        div
            [ style
                [ ( "padding", "10px" )
                , ( "background", "transparent" )
                , ( "color", "lightgray" )
                , ( "font-family", "menlo, monospaced" )
                , ( "font-size", "16px" )
                , ( "z-index", "99999999999" )
                ]
            ]
            [ text entity.selector
            , div
                [ style
                    [ ( "font-size", "10px" )
                    , ( "color", "grey" )
                    ]
                ]
                [ text ((toString len) ++ " elem. ")
                ]
            , entity.pickedElements
                |> List.indexedMap
                    (\i el ->
                        Html.li
                            [ onClick <| inspect ( entity.selector, i )
                            -- , Events.onMouseOver <| highlight ( Just entity.selector, i )
                            -- , Events.onMouseOut <| highlight ( Nothing, 0 )
                            , Attributes.class "tag"
                            , style [ ( "padding", "1px" ) ]
                            ]
                            [ span [ style [ ("width", "1em" ), ("display", "inline-block"), ("text-align", "center") ]] [ if entity.primaryPick == i && len > 1 then
                                text "* "
                              else
                                text " "
                                ]
                            , span [ Attributes.class "tag-name" ] [ text <| "<" ++ el.tagName ++ ">" ]
                            , span [ Attributes.class "inner-text" ] [ text <| Maybe.withDefault "" el.label ]
                            , span [ Attributes.class "tag-name" ] [ text <| "</" ++ el.tagName ++ "> " ]
                            , text <| toString el.width
                            , text "×"
                            , text <| toString el.height
                            , text " "
                            , case el.data of
                                Just d ->
                                    Html.code [] [ text d ]

                                Nothing ->
                                    text ""
                            , el.properties
                                |> List.map (\prop -> Html.li []
                                  --[ text prop.name
                                  --, text " = "
                                  [ text <| toString prop.data
                                  ]
                                )
                                |> Html.ul []
                            ]
                    )
                |> Html.ul [ style [ ( "font-size", "10px" ), ( "padding", "0" ) ] ]
            ]

